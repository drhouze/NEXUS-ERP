import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/erp/notifications/[id] - mark single notification as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && notif.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.notification.update({ where: { id }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
