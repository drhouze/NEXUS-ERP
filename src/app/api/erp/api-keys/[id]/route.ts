import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (key.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    if (body.isActive !== undefined) {
      await db.apiKey.update({ where: { id }, data: { isActive: body.isActive } })
      await logAction({
        ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId! },
        action: 'update', entityType: 'api_key', entityId: id, entityName: key.name,
        summary: `${body.isActive ? 'Activated' : 'Revoked'} API key "${key.name}"`,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (key.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.apiKey.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId! },
    action: 'delete', entityType: 'api_key', entityId: id, entityName: key.name,
    summary: `Deleted API key "${key.name}"`,
  })

  return NextResponse.json({ ok: true })
}
