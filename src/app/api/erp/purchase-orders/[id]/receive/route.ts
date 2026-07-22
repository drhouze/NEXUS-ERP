import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction, createNotification } from '@/lib/audit'
import { seedChartOfAccounts, postJournalEntry } from '@/lib/accounting'

// PATCH /api/erp/purchase-orders/[id]/receive - mark PO as received + auto-increment stock
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } } },
  })
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  if (user.role !== 'OWNER' && po.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { partial } = body // if partial=true, only increment stock but keep PO status as "sent"

    const result = await db.$transaction(async (tx) => {
      // Increment stock for all PO items + log stock movements
      for (const item of po.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.qty } },
        })
        // Log stock movement
        await tx.stockMovement.create({
          data: {
            tenantId: po.tenantId,
            productId: item.productId,
            warehouseId: item.product.warehouseId,
            type: 'in',
            quantity: item.qty,
            reason: 'received_po',
            refType: 'purchase_order',
            refId: po.id,
            notes: `Received via ${po.poNumber}`,
          },
        })
      }

      // Update PO status
      const newStatus = partial ? 'sent' : 'received'
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
        include: { supplier: true, items: { include: { product: true } } },
      })

      // Create expense transaction (only for full receive)
      if (!partial) {
        await tx.transaction.create({
          data: {
            tenantId: po.tenantId,
            type: 'expense',
            category: 'Supplies',
            amount: po.total,
            description: `Purchase Order ${po.poNumber} received (${po.supplier.name})`,
            date: new Date(),
            refType: 'purchase_order',
            refId: po.id,
          },
        })
      }

      return updated
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: po.tenantId },
      action: 'status_change',
      entityType: 'purchase_order',
      entityId: id,
      entityName: po.poNumber,
      summary: `PO ${po.poNumber} ${partial ? 'partially received (stock updated)' : 'received'} — stock incremented for ${po.items.length} product(s)`,
      metadata: { from: po.status, to: partial ? 'sent' : 'received', itemCount: po.items.length },
    })

    // Notify tenant admins
    const admins = await db.user.findMany({ where: { tenantId: po.tenantId, role: 'TENANT_ADMIN', status: 'active' } })
    for (const admin of admins) {
      await createNotification({
        tenantId: po.tenantId, userId: admin.id,
        type: 'success', category: 'purchase',
        title: `PO ${partial ? 'Partially Received' : 'Received'}`,
        message: `${po.poNumber} from ${po.supplier.name} — stock updated for ${po.items.length} product(s)`,
      })
    }

    // Post double-entry journal entry (only for full receive)
    if (!partial) {
      try {
        await seedChartOfAccounts(po.tenantId)
        await postJournalEntry({
          tenantId: po.tenantId,
          description: `PO ${po.poNumber} received — ${po.supplier.name}`,
          refType: 'purchase_order',
          refId: po.id,
          lines: [
            { accountCode: '1200', debit: po.total, description: 'Inventory' },
            { accountCode: '2000', credit: po.total, description: 'Accounts Payable' },
          ],
        })
      } catch (e) {
        console.error('Journal entry for PO receive failed:', e)
      }
    }

    return NextResponse.json({ po: result })
  } catch (e: any) {
    console.error('Receive PO error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
