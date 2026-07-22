import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// PATCH /api/erp/roles/[id] — update a role (admin only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'users')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const role = await db.role.findUnique({ where: { id } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && role.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description || null
    if (body.permissions !== undefined) {
      updates.permissions = typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions)
    }

    const updated = await db.role.update({ where: { id }, data: updates })
    return NextResponse.json({ role: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/roles/[id] — delete a custom role (admin only, not system roles)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'users')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && role.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role.isSystem) {
    return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 })
  }
  if (role._count.users > 0) {
    return NextResponse.json({ error: `Cannot delete: ${role._count.users} users are assigned to this role. Reassign them first.` }, { status: 400 })
  }

  await db.role.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
