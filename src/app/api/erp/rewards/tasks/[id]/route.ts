import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// PATCH /api/erp/rewards/tasks/[id] — update a reward task (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const task = await db.rewardTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && task.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description || null
    if (body.points !== undefined) updates.points = parseInt(body.points) || 0
    if (body.triggerType !== undefined) updates.triggerType = body.triggerType
    if (body.isActive !== undefined) updates.isActive = !!body.isActive

    const updated = await db.rewardTask.update({ where: { id }, data: updates })
    return NextResponse.json({ task: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/rewards/tasks/[id] — delete a reward task (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const task = await db.rewardTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && task.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.rewardTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
