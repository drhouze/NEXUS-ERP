import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction, createNotification } from '@/lib/audit'
import { fireWebhooks } from '@/lib/webhooks'
import { seedChartOfAccounts, postJournalEntry } from '@/lib/accounting'
import { broadcast, REALTIME_EVENTS } from '@/lib/realtime'
import { getOrderStatuses, getTerminalOrderStatus } from '@/lib/status-pipeline'

function parseArr(v: any): any[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}
function parseObj(v: any): any {
  if (!v) return {}
  if (typeof v === 'object') return v
  try {
    return JSON.parse(v)
  } catch {
    return {}
  }
}

// PATCH /api/erp/orders/[id]/status - advance or change order status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const order = await db.salesOrder.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } }, encounter: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden - order belongs to a different tenant' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const newStatus = String(body.status || '')

    // ---- Validate status against the tenant's custom pipeline ----
    const validStatuses = await getOrderStatuses(order.tenantId)
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status "${newStatus}". Valid: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }

    const oldStatus = order.status
    const terminalStatus = await getTerminalOrderStatus(order.tenantId)
    const isCancelled = newStatus === 'cancelled'
    const isTerminal = !!terminalStatus && newStatus === terminalStatus
    const wasTerminal = !!terminalStatus && oldStatus === terminalStatus

    // ---- Server-side encounter gate ----
    // If advancing to the terminal status AND the tenant requires an encounter
    // before invoicing, block unless an encounter exists with all required
    // sections filled.
    if (isTerminal && !isCancelled) {
      const tpl = await db.encounterTemplate.findUnique({ where: { tenantId: order.tenantId } })
      if (tpl?.requireEncounterBeforeInvoice) {
        if (!order.encounter) {
          return NextResponse.json(
            { error: 'An encounter is required before this order can be marked as completed.' },
            { status: 400 },
          )
        }
        const requiredIds = parseArr<string>(tpl.requiredSectionIds)
        if (requiredIds.length > 0) {
          const data = parseObj(order.encounter.data)
          const sectionValues: Record<string, any> = data.sectionValues || {}
          const missing = requiredIds.filter(sid => !sectionValues[sid] && sectionValues[sid] !== 0)
          if (missing.length > 0) {
            return NextResponse.json(
              { error: `Required encounter sections are missing: ${missing.join(', ')}` },
              { status: 400 },
            )
          }
        }
      }
    }

    const updated = await db.salesOrder.update({
      where: { id },
      data: { status: newStatus },
      include: { customer: true, items: { include: { product: true } } },
    })

    // ---- Stock-out + revenue recognition on terminal status ----
    if (isTerminal && !wasTerminal) {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.qty } } })
          await tx.stockMovement.create({
            data: {
              tenantId: order.tenantId,
              productId: item.productId,
              warehouseId: item.product.warehouseId,
              type: 'out',
              quantity: -item.qty,
              reason: 'sales_order',
              refType: 'sales_order',
              refId: order.id,
              notes: `Sold via ${order.orderNumber}`,
            },
          })
        }
        await tx.transaction.create({
          data: {
            tenantId: order.tenantId, type: 'income', category: 'Product Sales',
            amount: order.total, description: `Sales Order ${order.orderNumber} (${terminalStatus})`,
            date: new Date(), refType: 'sales_order', refId: order.id,
          },
        })
        await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { increment: order.total } } })
      })

      // Post double-entry journal entry: Debit AR, Credit Revenue (+ COGS)
      try {
        await seedChartOfAccounts(order.tenantId)
        const cogs = order.items.reduce((s, item) => s + item.qty * item.product.cost, 0)
        await postJournalEntry({
          tenantId: order.tenantId,
          description: `Revenue recognition for ${order.orderNumber}`,
          refType: 'sales_order',
          refId: order.id,
          lines: [
            { accountCode: '1100', debit: order.total, description: 'Accounts Receivable' },
            { accountCode: '4000', credit: order.total, description: 'Sales Revenue' },
          ],
        })
        await postJournalEntry({
          tenantId: order.tenantId,
          description: `COGS for ${order.orderNumber}`,
          refType: 'sales_order',
          refId: order.id,
          lines: [
            { accountCode: '5000', debit: cogs, description: 'Cost of Goods Sold' },
            { accountCode: '1200', credit: cogs, description: 'Inventory' },
          ],
        })
      } catch (e) {
        console.error('Journal entry for order delivery failed:', e)
      }
    }

    // ---- Stock-return on cancellation if previously at terminal status ----
    if (isCancelled && wasTerminal) {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } })
          await tx.stockMovement.create({
            data: {
              tenantId: order.tenantId,
              productId: item.productId,
              warehouseId: item.product.warehouseId,
              type: 'in',
              quantity: item.qty,
              reason: 'return',
              refType: 'sales_order',
              refId: order.id,
              notes: `Restocked from cancelled ${order.orderNumber}`,
            },
          })
        }
        await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { decrement: order.total } } })
      })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
      action: 'status_change',
      entityType: 'order',
      entityId: id,
      entityName: order.orderNumber,
      summary: `Order ${order.orderNumber} status: ${oldStatus} → ${newStatus}`,
      metadata: { from: oldStatus, to: newStatus, customer: order.customer.company, terminal: terminalStatus },
    })

    if (isTerminal || isCancelled) {
      const admins = await db.user.findMany({ where: { tenantId: order.tenantId, role: 'TENANT_ADMIN', status: 'active' } })
      for (const admin of admins) {
        await createNotification({
          tenantId: order.tenantId, userId: admin.id,
          type: isCancelled ? 'warning' : 'success', category: 'order',
          title: `Order ${newStatus}`,
          message: `${order.orderNumber} for ${order.customer.company} is now ${newStatus}`,
        })
      }
    }

    // Fire webhook
    fireWebhooks(order.tenantId, `order.${newStatus}`, {
      orderNumber: order.orderNumber,
      customer: order.customer.company,
      oldStatus,
      newStatus,
      total: order.total,
    }).catch(console.error)

    // Broadcast real-time update
    broadcast(order.tenantId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
      orderNumber: order.orderNumber, oldStatus, newStatus,
    }).catch(console.error)
    broadcast(order.tenantId, REALTIME_EVENTS.DASHBOARD_REFRESH).catch(console.error)

    return NextResponse.json({ order: updated })
  } catch (e: any) {
    console.error('Update order status error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
