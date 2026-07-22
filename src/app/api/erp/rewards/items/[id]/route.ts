import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// PATCH /api/erp/rewards/items/[id] — update a reward item (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const item = await db.rewardItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && item.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description || null
    if (body.pointsCost !== undefined) updates.pointsCost = parseInt(body.pointsCost) || 0
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl || null
    if (body.stock !== undefined) updates.stock = parseInt(body.stock)
    if (body.isActive !== undefined) updates.isActive = !!body.isActive

    const updated = await db.rewardItem.update({ where: { id }, data: updates })
    return NextResponse.json({ item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/rewards/items/[id] — delete a reward item (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const item = await db.rewardItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && item.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.rewardItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
