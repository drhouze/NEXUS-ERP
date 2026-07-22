import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/inventory/warehouses
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const warehouses = await db.warehouse.findMany({
    where: filter,
    include: { _count: { select: { products: true, stockMovements: true } } },
    orderBy: { name: 'asc' },
  })

  // Get stock value per warehouse
  const products = await db.product.findMany({ where: filter, select: { warehouseId: true, stockQty: true, cost: true, price: true } })
  const warehouseStats: Record<string, { productCount: number; stockValue: number; retailValue: number }> = {}
  for (const p of products) {
    const key = p.warehouseId || 'none'
    if (!warehouseStats[key]) warehouseStats[key] = { productCount: 0, stockValue: 0, retailValue: 0 }
    warehouseStats[key].productCount++
    warehouseStats[key].stockValue += p.stockQty * p.cost
    warehouseStats[key].retailValue += p.stockQty * p.price
  }

  return NextResponse.json({ warehouses, warehouseStats })
}

// POST - create warehouse
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.role === 'OWNER' ? (await req.clone().json()).targetTenantId || user.tenantId : user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { code, name, address } = body
    if (!code || !name) return NextResponse.json({ error: 'Code and name required' }, { status: 400 })

    const existing = await db.warehouse.findUnique({ where: { tenantId_code: { tenantId, code } } })
    if (existing) return NextResponse.json({ error: 'Warehouse code already exists' }, { status: 400 })

    const warehouse = await db.warehouse.create({ data: { tenantId, code, name, address: address || null } })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'warehouse', entityId: warehouse.id, entityName: warehouse.name,
      summary: `Created warehouse "${warehouse.name}" (${warehouse.code})`,
    })

    return NextResponse.json({ warehouse })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
