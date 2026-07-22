import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * PATCH /api/erp/inventory/warehouses/[id]
 *
 * Body: { code?, name?, address?, isActive? }
 *   - isActive=false → archive (prevent if default warehouse)
 *   - isActive=true  → unarchive
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.warehouse.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const patch: any = {}

    if (body.code !== undefined) {
      const newCode = String(body.code)
      if (newCode !== existing.code) {
        const clash = await db.warehouse.findUnique({
          where: { tenantId_code: { tenantId: existing.tenantId, code: newCode } },
        })
        if (clash) return NextResponse.json({ error: 'Warehouse code already exists' }, { status: 400 })
      }
      patch.code = newCode
    }
    if (body.name !== undefined) patch.name = String(body.name)
    if (body.address !== undefined) patch.address = body.address || null

    // ---- Archive / unarchive ----
    if (body.isActive !== undefined) {
      const wantActive = !!body.isActive
      if (!wantActive && existing.isDefault) {
        return NextResponse.json(
          { error: 'Cannot archive the default warehouse. Assign a new default first.' },
          { status: 400 },
        )
      }
      patch.isActive = wantActive
    }

    const updated = await db.warehouse.update({ where: { id }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
      action: 'update',
      entityType: 'warehouse',
      entityId: id,
      entityName: updated.name,
      summary: `Updated warehouse "${updated.name}" (${updated.code})` +
        (patch.isActive === false ? ' [archived]' : patch.isActive === true ? ' [unarchived]' : ''),
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({ warehouse: updated })
  } catch (e: any) {
    console.error('Update warehouse error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/erp/inventory/warehouses/[id]
 *
 * Hard-delete only when the warehouse has no products and no stock movements.
 * The default warehouse cannot be deleted.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { products: true, stockMovements: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (existing.isDefault) {
    return NextResponse.json(
      { error: 'Cannot delete the default warehouse. Assign a new default first.' },
      { status: 400 },
    )
  }
  if (existing._count.products > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${existing._count.products} product(s) are still assigned to this warehouse.` },
      { status: 400 },
    )
  }
  if (existing._count.stockMovements > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${existing._count.stockMovements} stock movement(s) reference this warehouse.` },
      { status: 400 },
    )
  }

  await db.warehouse.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
    action: 'delete',
    entityType: 'warehouse',
    entityId: id,
    entityName: existing.name,
    summary: `Deleted warehouse "${existing.name}" (${existing.code})`,
  })

  return NextResponse.json({ ok: true })
}
