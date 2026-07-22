import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  if (user.role !== 'OWNER' && supplier.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.contactName !== undefined) updates.contactName = body.contactName
    if (body.email !== undefined) updates.email = body.email.toLowerCase()
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.country !== undefined) updates.country = body.country
    if (body.rating !== undefined) updates.rating = parseInt(body.rating)

    const updated = await db.supplier.update({ where: { id }, data: updates })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: supplier.tenantId },
      action: 'update', entityType: 'supplier', entityId: id, entityName: updated.name,
      summary: `Updated supplier "${updated.name}"`,
    })

    return NextResponse.json({ supplier: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  if (user.role !== 'OWNER' && supplier.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.supplier.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: supplier.tenantId },
    action: 'delete', entityType: 'supplier', entityId: id, entityName: supplier.name,
    summary: `Deleted supplier "${supplier.name}"`,
  })

  return NextResponse.json({ ok: true })
}
