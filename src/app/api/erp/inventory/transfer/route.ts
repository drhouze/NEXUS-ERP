import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// POST /api/erp/inventory/transfer - transfer stock between warehouses
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, fromWarehouseId, toWarehouseId, quantity, notes, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
      return NextResponse.json({ error: 'Product, from warehouse, to warehouse, and quantity required' }, { status: 400 })
    }
    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ error: 'Source and destination warehouses must be different' }, { status: 400 })
    }

    const product = await db.product.findFirst({ where: { id: productId, tenantId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const qty = parseInt(quantity)
    if (product.stockQty < qty) {
      return NextResponse.json({ error: `Insufficient stock. Current: ${product.stockQty}, requested: ${qty}` }, { status: 400 })
    }

    const fromWh = await db.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId } })
    const toWh = await db.warehouse.findFirst({ where: { id: toWarehouseId, tenantId } })
    if (!fromWh || !toWh) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })

    const result = await db.$transaction(async (tx) => {
      // Create transfer_out movement
      const outMovement = await tx.stockMovement.create({
        data: {
          tenantId, productId, warehouseId: fromWarehouseId,
          type: 'transfer_out', quantity: -qty, reason: 'transfer',
          fromWarehouseId, toWarehouseId, notes: notes || `Transfer to ${toWh.name}`,
        },
      })

      // Create transfer_in movement
      const inMovement = await tx.stockMovement.create({
        data: {
          tenantId, productId, warehouseId: toWarehouseId,
          type: 'transfer_in', quantity: qty, reason: 'transfer',
          fromWarehouseId, toWarehouseId, notes: notes || `Transfer from ${fromWh.name}`,
        },
      })

      // Update product's warehouse to destination + stock stays same (it's a move, not add/remove)
      // In a full multi-warehouse system, we'd track per-warehouse stock. For now, we update the product's warehouseId.
      const updated = await tx.product.update({
        where: { id: productId },
        data: { warehouseId: toWarehouseId, warehouse: toWh.code },
      })

      return { outMovement, inMovement, updated }
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'stock_movement', entityId: result.outMovement.id,
      summary: `Transferred ${qty} units of "${product.name}" from ${fromWh.name} to ${toWh.name}`,
      metadata: { productId, fromWarehouseId, toWarehouseId, quantity: qty },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Transfer error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
