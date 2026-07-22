import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// PATCH /api/erp/partner-shops/[id] — update a partner shop (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const shop = await db.partnerShop.findUnique({ where: { id } })
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && shop.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description || null
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl || null
    if (body.category !== undefined) updates.category = body.category
    if (body.isActive !== undefined) updates.isActive = !!body.isActive
    if (body.ownerUserId !== undefined) updates.ownerUserId = body.ownerUserId
    if (body.isGlobal !== undefined) updates.isGlobal = !!body.isGlobal

    const updated = await db.partnerShop.update({ where: { id }, data: updates })
    return NextResponse.json({ shop: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/partner-shops/[id] — delete a partner shop (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const shop = await db.partnerShop.findUnique({ where: { id } })
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && shop.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.partnerShop.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
