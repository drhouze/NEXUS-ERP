import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { generateNumber } from '@/lib/numbering'

// POST /api/erp/orders/[id]/duplicate - create a copy of an existing order
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const original = await db.salesOrder.findUnique({
    where: { id },
    include: { customer: true, items: true },
  })
  if (!original) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Tenant isolation
  if (user.role !== 'OWNER' && original.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = original.tenantId
  const orderNumber = await generateNumber(tenantId, 'salesOrder')

  // Re-fetch current product prices (don't copy old prices — use live prices)
  const productIds = original.items.map(it => it.productId)
  const products = await db.product.findMany({ where: { id: { in: productIds }, tenantId } })

  const lineItems = original.items.map(it => {
    const product = products.find(p => p.id === it.productId)
    return {
      productId: it.productId,
      qty: it.qty,
      unitPrice: product?.price || it.unitPrice, // use current price, fall back to original
    }
  })
  const total = lineItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)

  const duplicated = await db.salesOrder.create({
    data: {
      tenantId,
      orderNumber,
      customerId: original.customerId,
      status: 'pending', // always start as pending
      total,
      items: { create: lineItems },
    },
    include: { customer: true, items: { include: { product: true } } },
  })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
    action: 'create',
    entityType: 'order',
    entityId: duplicated.id,
    entityName: duplicated.orderNumber,
    summary: `Duplicated order ${original.orderNumber} → ${duplicated.orderNumber} (${original.customer.company})`,
    metadata: { duplicatedFrom: original.orderNumber },
  })

  return NextResponse.json({ order: duplicated })
}
