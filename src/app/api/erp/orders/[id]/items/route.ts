import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { broadcast, REALTIME_EVENTS } from '@/lib/realtime'

/**
 * PATCH /api/erp/orders/[id]/items
 *
 * Replace ALL line items on an order.
 * Body: { items: [{ productId, qty, unitPrice }] }
 *
 * - Validates every product belongs to the tenant.
 * - Deletes existing items, creates the new ones, recalculates the total.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const order = await db.salesOrder.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }

    // ---- Validate every product belongs to the tenant ----
    const productIds = items.map((it: any) => it.productId).filter(Boolean)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: order.tenantId },
      select: { id: true, price: true, name: true },
    })
    const byId = new Map(products.map(p => [p.id, p]))
    for (const it of items) {
      if (!it.productId || !byId.has(it.productId)) {
        return NextResponse.json({ error: `Invalid product: ${it.productId}` }, { status: 400 })
      }
    }

    // ---- Replace items + recalc total in a single transaction ----
    const result = await db.$transaction(async (tx) => {
      await tx.salesOrderItem.deleteMany({ where: { orderId: order.id } })

      const lineItems = items.map((it: any) => {
        const prod = byId.get(it.productId)!
        const qty = parseInt(it.qty) || 1
        // Fall back to the product's catalogue price when no unitPrice is given.
        const unitPrice = it.unitPrice != null ? parseFloat(it.unitPrice) : prod.price
        return { orderId: order.id, productId: it.productId, qty, unitPrice }
      })

      await tx.salesOrderItem.createMany({ data: lineItems })

      const total = lineItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)
      const updated = await tx.salesOrder.update({ where: { id: order.id }, data: { total } })

      return { lineItems, total, updated }
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
      action: 'update',
      entityType: 'order',
      entityId: order.id,
      entityName: order.orderNumber,
      summary: `Replaced ${result.lineItems.length} line items on ${order.orderNumber} (new total ${order.currency} ${result.total.toFixed(2)})`,
      metadata: { itemCount: result.lineItems.length, total: result.total },
    })

    broadcast(order.tenantId, REALTIME_EVENTS.DASHBOARD_REFRESH).catch(console.error)

    const refreshed = await db.salesOrder.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true } } },
    })

    return NextResponse.json({ order: refreshed, total: result.total })
  } catch (e: any) {
    console.error('Replace order items error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
