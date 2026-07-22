import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const products = await db.product.findMany({
    where: filter,
    include: { supplier: true, warehouseRel: true },
    orderBy: { name: 'asc' },
  })
  const categories = await db.product.groupBy({ by: ['category'], where: filter, _count: true })

  // Cost + retail valuation
  const totalCostValue = products.reduce((s, p) => s + p.cost * p.stockQty, 0)
  const totalRetailValue = products.reduce((s, p) => s + p.price * p.stockQty, 0)
  const totalPotentialMargin = totalRetailValue - totalCostValue

  // Products with margin calculation
  const productsWithMargin = products.map(p => ({
    ...p,
    costValue: p.cost * p.stockQty,
    retailValue: p.price * p.stockQty,
    margin: p.price - p.cost,
    marginPct: p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0,
    warehouseName: p.warehouseRel?.name || p.warehouse || 'Unassigned',
    warehouseCode: p.warehouseRel?.code || p.warehouse || '—',
  }))

  return NextResponse.json({
    products: productsWithMargin,
    categories,
    summary: {
      total: products.length,
      totalValue: totalRetailValue, // legacy field
      totalCost: totalCostValue,
      totalRetailValue,
      totalCostValue,
      totalPotentialMargin,
      marginPct: totalRetailValue > 0 ? (totalPotentialMargin / totalRetailValue) * 100 : 0,
      lowStock: products.filter(p => p.productType !== 'service' && p.stockQty <= p.reorderLevel).length,
      outOfStock: products.filter(p => p.productType !== 'service' && p.stockQty === 0).length,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      name, sku, category, price, cost, stockQty, reorderLevel, reorderQty,
      warehouseId, supplierId,
      packSize, packUnit, baseUnit, productType,
      targetTenantId,
    } = body

    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!name || !sku || !category || price == null || cost == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await db.product.findUnique({ where: { tenantId_sku: { tenantId, sku } } })
    if (existing) return NextResponse.json({ error: 'SKU already exists in this tenant' }, { status: 400 })

    // Resolve warehouse name from warehouseId
    let warehouseName = 'WH-Central'
    if (warehouseId) {
      const wh = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (wh) warehouseName = wh.code
    }

    const product = await db.product.create({
      data: {
        tenantId,
        name, sku, category,
        price: parseFloat(price),
        cost: parseFloat(cost),
        stockQty: parseInt(stockQty) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        reorderQty: parseInt(reorderQty) || 50,
        warehouse: warehouseName,
        warehouseId: warehouseId || null,
        supplierId: supplierId || null,
        // Pack-based billing (defaults: 1 pack = 1 unit)
        packSize: packSize != null ? parseInt(packSize) || 1 : 1,
        packUnit: packUnit || 'pack',
        baseUnit: baseUnit || 'unit',
        productType: productType || 'standard',
      },
      include: { supplier: true, warehouseRel: true },
    })

    // Log initial stock movement if stockQty > 0
    if (product.stockQty > 0) {
      await db.stockMovement.create({
        data: {
          tenantId, productId: product.id, warehouseId: product.warehouseId,
          type: 'in', quantity: product.stockQty, reason: 'initial',
          notes: 'Initial stock on product creation',
        },
      })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'product', entityId: product.id, entityName: product.name,
      summary: `Created product "${product.name}" (${product.sku})`,
      metadata: { sku, price, cost, stockQty },
    })

    return NextResponse.json({ product })
  } catch (e: any) {
    console.error('Create product error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
