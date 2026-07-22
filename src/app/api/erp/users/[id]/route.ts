import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// PATCH /api/erp/users/[id] - edit / disable / enable / change role / reset password
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // TENANT_ADMIN can only manage users in their own tenant; OWNER can manage any
  if (user.role === 'TENANT_ADMIN' && target.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden - user is in a different tenant' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    let action = 'update'
    let summary = ''

    if (body.name !== undefined) updates.name = body.name
    if (body.email !== undefined) updates.email = body.email.toLowerCase()
    if (body.status !== undefined) {
      if (!['active', 'disabled'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = body.status
      action = body.status === 'disabled' ? 'archive' : 'restore'
      summary = `${body.status === 'disabled' ? 'Archived' : 'Restored'} user "${target.name}"`
    }
    // Portal type
    if (body.portalType !== undefined) {
      updates.portalType = body.portalType
    }
    // Per-user module permissions (JSON array of module keys, or null for role defaults)
    if (body.modulePermissions !== undefined) {
      updates.modulePermissions = body.modulePermissions
        ? (typeof body.modulePermissions === 'string' ? body.modulePermissions : JSON.stringify(body.modulePermissions))
        : null
    }
    // Custom role assignment
    if (body.customRoleId !== undefined) {
      updates.customRoleId = body.customRoleId || null
    }
    // Role change (including to/from CUSTOM)
    if (body.role !== undefined) {
      if (!['TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updates.role = body.role
    }

    // Password reset
    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      updates.password = await bcrypt.hash(body.newPassword, 10)
      action = 'reset_password'
      summary = `Reset password for user "${target.name}"`
    }

    if (!summary) {
      summary = `Updated user "${target.name}"`
    }

    const updated = await db.user.update({ where: { id }, data: updates, select: { id: true, email: true, name: true, role: true, status: true, emailVerified: true, lastLoginAt: true, createdAt: true, tenantId: true, portalType: true, modulePermissions: true, points: true, customRoleId: true } })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: target.tenantId || undefined },
      action,
      entityType: 'user',
      entityId: id,
      entityName: target.name,
      summary,
      metadata: { before: { role: target.role, status: target.status }, after: { role: updated.role, status: updated.status } },
    })

    return NextResponse.json({ user: updated })
  } catch (e: any) {
    console.error('Update user error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/users/[id] - permanently delete user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.role === 'TENANT_ADMIN' && target.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden - user is in a different tenant' }, { status: 403 })
  }

  // Prevent self-deletion
  if (target.id === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: target.tenantId || undefined },
    action: 'delete',
    entityType: 'user',
    entityId: id,
    entityName: target.name,
    summary: `Deleted user "${target.name}" (${target.email})`,
  })

  await db.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
