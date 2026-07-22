import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// POST /api/erp/orders/[id]/refresh-prices — update all line item prices to current product prices
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const order = await db.salesOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let updatedCount = 0
  let newTotal = 0

  for (const item of order.items) {
    if (!item.product) continue
    const currentPrice = item.product.price
    if (Math.abs(item.unitPrice - currentPrice) > 0.001) {
      await db.salesOrderItem.update({
        where: { id: item.id },
        data: { unitPrice: currentPrice },
      })
      updatedCount++
    }
    newTotal += item.qty * currentPrice
  }

  await db.salesOrder.update({
    where: { id: order.id },
    data: { total: newTotal },
  })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
    action: 'update', entityType: 'order', entityId: order.id, entityName: order.orderNumber,
    summary: `Refreshed ${updatedCount} line item prices for ${order.orderNumber} — new total: ${newTotal.toFixed(2)}`,
  })

  return NextResponse.json({ ok: true, updatedCount, newTotal })
}
