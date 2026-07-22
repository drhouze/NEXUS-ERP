import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction, createNotification } from '@/lib/audit'
import { fireWebhooks } from '@/lib/webhooks'
import { generateNumber } from '@/lib/numbering'
import { triggerWorkflows } from '@/lib/workflow-executor'
import { broadcast, REALTIME_EVENTS } from '@/lib/realtime'

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

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const orders = await db.salesOrder.findMany({
    where: filter,
    include: {
      customer: true,
      items: { include: { product: true } },
      // Include the encounter (1:1) — only the fields the UI needs.
      encounter: { select: { id: true, data: true, doctorName: true, updatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Also load the tenant's encounter template so the order list / detail view
  // can show the encounter gate (requireEncounterBeforeInvoice, required sections…).
  let encounterTemplate: any = null
  if (user.tenantId) {
    const tpl = await db.encounterTemplate.findUnique({ where: { tenantId: user.tenantId } })
    if (tpl) {
      encounterTemplate = {
        ...tpl,
        sections: parseArr(tpl.sections),
        itemTables: parseArr(tpl.itemTables),
        requiredSectionIds: parseArr(tpl.requiredSectionIds),
      }
    }
  }

  const statusCounts = await db.salesOrder.groupBy({ by: ['status'], where: filter, _count: true, _sum: { total: true } })
  const totalRevenue = orders.filter(o => o.status === 'delivered' || o.status === 'shipped').reduce((s, o) => s + o.total, 0)
  const avgOrderValue = orders.length ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0

  return NextResponse.json({
    orders,
    statusCounts,
    encounterTemplate,
    summary: {
      total: orders.length,
      totalRevenue,
      avgOrderValue,
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { customerId, status, items, targetTenantId, discountType, discountValue, taxRate } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Customer and at least one line item are required' }, { status: 400 })
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!customer) return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })

    const productIds = items.map((it: any) => it.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds }, tenantId } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more invalid products' }, { status: 400 })
    }

    const lineItems = items.map((it: any) => {
      const product = products.find(p => p.id === it.productId)!
      return { productId: it.productId, qty: parseInt(it.qty) || 1, unitPrice: product.price }
    })
    const subtotal = lineItems.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0)

    // ---- Calculate discount ----
    let discountAmount = 0
    if (discountType && discountValue && discountValue > 0) {
      if (discountType === 'percentage') {
        discountAmount = subtotal * (discountValue / 100)
      } else if (discountType === 'fixed') {
        discountAmount = Math.min(discountValue, subtotal) // can't discount more than subtotal
      }
    }

    // ---- Calculate tax (on discounted amount) ----
    const taxPct = taxRate ? parseFloat(taxRate) : 0
    const afterDiscount = subtotal - discountAmount
    const taxAmt = afterDiscount * (taxPct / 100)

    // ---- Final total ----
    const total = afterDiscount + taxAmt

    const orderNumber = await generateNumber(tenantId, 'salesOrder')

    // ---- Fetch the tenant's base currency (fall back to USD) ----
    const baseCurrency = await db.currency.findFirst({ where: { tenantId, isBase: true } })
    const currencyCode = baseCurrency?.code || 'USD'

    const order = await db.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerId,
        status: status || 'pending',
        total,
        currency: currencyCode,
        subtotal,
        discountType: discountType || null,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        discountAmount,
        taxRate: taxPct,
        taxAmount: taxAmt,
        items: { create: lineItems },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        encounter: { select: { id: true, data: true, doctorName: true, updatedAt: true } },
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'order',
      entityId: order.id,
      entityName: order.orderNumber,
      summary: `Created sales order ${order.orderNumber} for ${customer.company} - ${currencyCode} ${total.toFixed(0)}`,
      metadata: { customer: customer.company, total, currency: currencyCode, itemCount: lineItems.length },
    })

    // Notify tenant admins about new order
    const tenantAdmins = await db.user.findMany({ where: { tenantId, role: 'TENANT_ADMIN', status: 'active' } })
    for (const admin of tenantAdmins) {
      await createNotification({
        tenantId, userId: admin.id, type: 'info', category: 'order',
        title: 'New Sales Order',
        message: `${order.orderNumber} placed by ${customer.company} for ${currencyCode} ${total.toFixed(0)}`,
      })
    }

    // Fire webhook
    fireWebhooks(order.tenantId, 'order.created', {
      orderNumber: order.orderNumber,
      customer: order.customer.company,
      total: order.total,
      status: order.status,
    }).catch(console.error)

    // Trigger workflows
    triggerWorkflows(order.tenantId, 'order.created', {
      entityType: 'order', entityId: order.id,
      data: { orderNumber: order.orderNumber, customer: order.customer.company, total: order.total },
    }).catch(console.error)

    // Broadcast real-time update
    broadcast(order.tenantId, REALTIME_EVENTS.ORDER_CREATED, {
      orderNumber: order.orderNumber, customer: order.customer.company, total: order.total,
    }).catch(console.error)
    broadcast(order.tenantId, REALTIME_EVENTS.DASHBOARD_REFRESH).catch(console.error)

    return NextResponse.json({ order })
  } catch (e: any) {
    console.error('Create order error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
