import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// PATCH /api/erp/tenants/[id] - edit / suspend / unsuspend / upgrade
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // OWNER can edit any tenant; TENANT_ADMIN can edit their own (limited fields)
  const tenant = await db.tenant.findUnique({ where: { id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const isOwner = user.role === 'OWNER'
  const isOwnAdmin = user.role === 'TENANT_ADMIN' && user.tenantId === id
  if (!isOwner && !isOwnAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}

    // Common editable fields
    if (body.name !== undefined) updates.name = body.name
    if (body.industry !== undefined) updates.industry = body.industry
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl
    if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor

    // OWNER-only fields
    if (isOwner) {
      if (body.plan !== undefined) updates.plan = body.plan
      if (body.seats !== undefined) updates.seats = parseInt(body.seats)

      // Suspend / unsuspend
      if (body.status === 'suspended') {
        updates.status = 'suspended'
        updates.suspendedAt = new Date()
        updates.suspendedReason = body.reason || 'Suspended by platform owner'
      } else if (body.status === 'active' && tenant.status === 'suspended') {
        updates.status = 'active'
        updates.suspendedAt = null
        updates.suspendedReason = null
      } else if (body.status !== undefined) {
        updates.status = body.status
      }
    }

    const updated = await db.tenant.update({ where: { id }, data: updates })

    // Audit log
    const actionType = body.status === 'suspended' ? 'suspend' : (body.status === 'active' && tenant.status === 'suspended' ? 'unsuspend' : (body.plan ? 'upgrade' : 'update'))
    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: id },
      action: actionType,
      entityType: 'tenant',
      entityId: id,
      entityName: updated.name,
      summary: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} tenant "${updated.name}"`,
      metadata: updates,
    })

    return NextResponse.json({ tenant: updated })
  } catch (e: any) {
    console.error('Update tenant error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/tenants/[id] - permanently delete tenant + all data (OWNER only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only platform owners can delete tenants' }, { status: 403 })
  }
  const { id } = await params

  const tenant = await db.tenant.findUnique({ where: { id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Log BEFORE delete (since cascade will wipe audit logs of that tenant)
  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role },
    action: 'delete',
    entityType: 'tenant',
    entityId: id,
    entityName: tenant.name,
    summary: `Deleted tenant "${tenant.name}" and ALL associated data`,
    metadata: { plan: tenant.plan, seats: tenant.seats },
  })

  // Cascade delete via Prisma (all tenant-scoped models have onDelete: Cascade)
  await db.tenant.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
