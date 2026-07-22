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

  const webhook = await db.webhook.findUnique({ where: { id } })
  if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (webhook.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.url) updates.url = body.url
    if (body.events) updates.events = JSON.stringify(body.events)
    if (body.secret !== undefined) updates.secret = body.secret
    if (body.isActive !== undefined) updates.isActive = body.isActive

    const updated = await db.webhook.update({ where: { id }, data: updates })
    return NextResponse.json({ webhook: updated })
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

  const webhook = await db.webhook.findUnique({ where: { id } })
  if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (webhook.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.webhook.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId! },
    action: 'delete', entityType: 'webhook', entityId: id,
    summary: `Deleted webhook ${webhook.url}`,
  })

  return NextResponse.json({ ok: true })
}
