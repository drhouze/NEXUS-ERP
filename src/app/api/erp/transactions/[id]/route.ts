import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'finance')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const txn = await db.transaction.findUnique({ where: { id } })
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (user.role !== 'OWNER' && txn.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.type !== undefined) updates.type = body.type
    if (body.category !== undefined) updates.category = body.category
    if (body.amount !== undefined) updates.amount = parseFloat(body.amount)
    if (body.description !== undefined) updates.description = body.description
    if (body.date !== undefined) updates.date = new Date(body.date)

    const updated = await db.transaction.update({ where: { id }, data: updates })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: txn.tenantId },
      action: 'update', entityType: 'transaction', entityId: id, entityName: updated.description,
      summary: `Updated transaction "${updated.description}"`,
    })

    return NextResponse.json({ transaction: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'finance')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const txn = await db.transaction.findUnique({ where: { id } })
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (user.role !== 'OWNER' && txn.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.transaction.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: txn.tenantId },
    action: 'delete', entityType: 'transaction', entityId: id, entityName: txn.description,
    summary: `Deleted transaction "${txn.description}"`,
  })

  return NextResponse.json({ ok: true })
}
