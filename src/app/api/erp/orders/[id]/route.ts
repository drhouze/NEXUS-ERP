import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// PATCH /api/erp/orders/[id] — update order fields (status, discount, tax, notes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const order = await db.salesOrder.findUnique({
    where: { id },
    include: { items: true, customer: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}

    if (body.status !== undefined) updates.status = body.status

    // ---- Discount / tax recalculation ----
    let needsRecalc = false
    if (body.discountType !== undefined) {
      updates.discountType = body.discountType === '__none__' || !body.discountType ? null : body.discountType
      needsRecalc = true
    }
    if (body.discountValue !== undefined) {
      updates.discountValue = body.discountValue ? parseFloat(body.discountValue) : null
      needsRecalc = true
    }
    if (body.taxRate !== undefined) {
      updates.taxRate = body.taxRate ? parseFloat(body.taxRate) : 0
      needsRecalc = true
    }

    if (needsRecalc) {
      // Recalculate subtotal, discount, tax, total
      const subtotal = order.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
      const discountType = updates.discountType !== undefined ? updates.discountType : order.discountType
      const discountValue = updates.discountValue !== undefined ? updates.discountValue : order.discountValue
      const taxRate = updates.taxRate !== undefined ? updates.taxRate : order.taxRate

      let discountAmount = 0
      if (discountType && discountValue && discountValue > 0) {
        if (discountType === 'percentage') {
          discountAmount = subtotal * (discountValue / 100)
        } else if (discountType === 'fixed') {
          discountAmount = Math.min(discountValue, subtotal)
        }
      }

      const afterDiscount = subtotal - discountAmount
      const taxAmount = afterDiscount * ((taxRate || 0) / 100)
      const total = afterDiscount + taxAmount

      updates.subtotal = subtotal
      updates.discountAmount = discountAmount
      updates.taxAmount = taxAmount
      updates.total = total
    }

    const updated = await db.salesOrder.update({
      where: { id },
      data: updates,
      include: { customer: true, items: { include: { product: true } } },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
      action: 'update', entityType: 'order', entityId: id, entityName: order.orderNumber,
      summary: `Updated order ${order.orderNumber}: ${Object.keys(updates).join(', ')}`,
    })

    return NextResponse.json({ order: updated })
  } catch (e: any) {
    console.error('Update order error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
