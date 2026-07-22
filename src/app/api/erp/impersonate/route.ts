import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { createToken, setSessionCookie } from '@/lib/session'
import { logAction } from '@/lib/audit'

// POST /api/erp/impersonate - OWNER logs in as a tenant user
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only platform owners can impersonate' }, { status: 403 })
  }

  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    })

    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!targetUser.tenantId) return NextResponse.json({ error: 'Target has no tenant' }, { status: 400 })
    if (targetUser.tenant?.status === 'suspended') {
      return NextResponse.json({ error: 'Cannot impersonate user in suspended tenant' }, { status: 400 })
    }

    // Mark the target user as being impersonated by this owner
    await db.user.update({
      where: { id: targetUser.id },
      data: { impersonatedBy: user.id },
    })

    // Create a session token for the target user
    const token = createToken({
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role as any,
      tenantId: targetUser.tenantId,
    })
    await setSessionCookie(token)

    // Audit log (in the OWNER's tenant context, which is null, + the target tenant)
    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: targetUser.tenantId },
      action: 'login',
      entityType: 'auth',
      entityId: targetUser.id,
      summary: `OWNER ${user.email} started impersonating ${targetUser.email} (${targetUser.tenant?.name})`,
      metadata: { impersonated: true, targetUser: targetUser.email, targetTenant: targetUser.tenantId },
    })

    return NextResponse.json({
      ok: true,
      impersonating: { id: targetUser.id, email: targetUser.email, name: targetUser.name, role: targetUser.role, tenant: targetUser.tenant },
    })
  } catch (e: any) {
    console.error('Impersonate error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/impersonate - end impersonation (restore owner session)
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the owner who is impersonating this user
  const targetUser = await db.user.findUnique({ where: { id: user.id } })
  if (!targetUser?.impersonatedBy) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 })
  }

  const owner = await db.user.findUnique({ where: { id: targetUser.impersonatedBy } })
  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // Clear impersonation flag
  await db.user.update({
    where: { id: targetUser.id },
    data: { impersonatedBy: null },
  })

  // Restore owner session
  const token = createToken({
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role as any,
    tenantId: '',
  })
  await setSessionCookie(token)

  await logAction({
    ctx: { actorId: owner.id, actorEmail: owner.email, actorRole: owner.role, tenantId: targetUser.tenantId || undefined },
    action: 'logout',
    entityType: 'auth',
    summary: `OWNER ${owner.email} ended impersonation of ${targetUser.email}`,
  })

  return NextResponse.json({ ok: true })
}
