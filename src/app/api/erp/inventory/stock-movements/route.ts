import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/inventory/stock-movements - list all stock movements
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const url = new URL(req.url)
  const productId = url.searchParams.get('productId')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  const where: any = filter
  if (productId) where.productId = productId

  const movements = await db.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { product: true, warehouse: true },
  })

  return NextResponse.json({ movements })
}

// POST /api/erp/inventory/stock-movements - record a manual stock adjustment
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, type, quantity, reason, notes, warehouseId, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    if (!productId || !type || !quantity) {
      return NextResponse.json({ error: 'Product, type, and quantity required' }, { status: 400 })
    }

    const product = await db.product.findFirst({ where: { id: productId, tenantId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const qty = parseInt(quantity)
    const movementQty = type === 'out' ? -Math.abs(qty) : Math.abs(qty)

    const result = await db.$transaction(async (tx) => {
      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          tenantId, productId, warehouseId: warehouseId || product.warehouseId,
          type, quantity: movementQty, reason: reason || 'adjustment',
          refType: 'manual', notes: notes || null,
        },
      })

      // Update product stock
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: movementQty } },
      })

      return { movement, updated }
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'stock_movement', entityId: result.movement.id,
      summary: `Stock ${type}: ${qty} units of "${product.name}" (${reason})`,
      metadata: { productId, type, quantity: qty, reason },
    })

    return NextResponse.json({ movement: result.movement, newStockQty: result.updated.stockQty })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
