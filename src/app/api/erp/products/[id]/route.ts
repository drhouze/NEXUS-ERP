import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// GET /api/erp/products/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    include: { supplier: true, warehouseRel: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && product.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ product })
}

/**
 * PATCH /api/erp/products/[id]
 *
 * NOTE: `route`, `dosageForm`, `strength`, `packaging` are NOT Product columns —
 * they're custom fields managed via /api/erp/custom-fields/values. This route
 * only persists the first-class Product columns (incl. pack fields).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.product.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const patch: any = {}

    if (body.name !== undefined) patch.name = String(body.name)
    if (body.sku !== undefined) {
      const newSku = String(body.sku)
      if (newSku !== existing.sku) {
        const clash = await db.product.findUnique({ where: { tenantId_sku: { tenantId: existing.tenantId, sku: newSku } } })
        if (clash) return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
      }
      patch.sku = newSku
    }
    if (body.category !== undefined) patch.category = String(body.category)
    if (body.price !== undefined) patch.price = parseFloat(body.price)
    if (body.cost !== undefined) patch.cost = parseFloat(body.cost)
    if (body.stockQty !== undefined) patch.stockQty = parseInt(body.stockQty) || 0
    if (body.reorderLevel !== undefined) patch.reorderLevel = parseInt(body.reorderLevel) || 0
    if (body.reorderQty !== undefined) patch.reorderQty = parseInt(body.reorderQty) || 0
    if (body.warehouseId !== undefined) {
      patch.warehouseId = body.warehouseId || null
      if (body.warehouseId) {
        const wh = await db.warehouse.findUnique({ where: { id: body.warehouseId } })
        if (wh) patch.warehouse = wh.code
      }
    }
    if (body.supplierId !== undefined) patch.supplierId = body.supplierId || null

    // ---- Pack-based billing fields ----
    if (body.packSize !== undefined) patch.packSize = parseInt(body.packSize) || 1
    if (body.packUnit !== undefined) patch.packUnit = String(body.packUnit || 'pack')
    if (body.baseUnit !== undefined) patch.baseUnit = String(body.baseUnit || 'unit')
    if (body.productType !== undefined) patch.productType = String(body.productType || 'standard')

    // NOTE: route, dosageForm, strength, packaging are NOT handled here.
    // They are custom fields and must be saved via /api/erp/custom-fields/values.

    const updated = await db.product.update({
      where: { id },
      data: patch,
      include: { supplier: true, warehouseRel: true },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
      action: 'update',
      entityType: 'product',
      entityId: id,
      entityName: updated.name,
      summary: `Updated product "${updated.name}" (${updated.sku})`,
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({ product: updated })
  } catch (e: any) {
    console.error('Update product error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/products/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.product.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.product.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
    action: 'delete',
    entityType: 'product',
    entityId: id,
    entityName: existing.name,
    summary: `Deleted product "${existing.name}" (${existing.sku})`,
  })

  return NextResponse.json({ ok: true })
}
