import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/inventory/stock-takes
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const stockTakes = await db.stockTake.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { warehouse: true, _count: { select: { items: true } } },
  })

  return NextResponse.json({ stockTakes })
}

// POST - create stock take
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { warehouseId, notes, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    // Create stock take + auto-populate with current stock levels
    const products = await db.product.findMany({
      where: { tenantId, ...(warehouseId ? { warehouseId } : {}) },
      select: { id: true, stockQty: true },
    })

    const stockTake = await db.stockTake.create({
      data: {
        tenantId,
        warehouseId: warehouseId || null,
        notes: notes || null,
        status: 'in_progress',
        startedAt: new Date(),
        items: {
          create: products.map(p => ({
            productId: p.id,
            systemQty: p.stockQty,
          })),
        },
      },
      include: { items: { include: { product: true } }, warehouse: true },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'stock_take', entityId: stockTake.id,
      summary: `Started stock take with ${products.length} items`,
    })

    return NextResponse.json({ stockTake })
  } catch (e: any) {
    console.error('Stock take error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
