import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/notifications - list unread + recent read notifications for current user
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = user.role === 'OWNER'
    ? {} // Owner sees all (cross-tenant) - actually owner doesn't have notifications since they have no tenant. Skip.
    : {
        tenantId: user.tenantId,
        OR: [
          { userId: user.id },
          { userId: null }, // broadcast to whole tenant
        ],
      }

  if (user.role === 'OWNER') {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return NextResponse.json({ notifications, unreadCount })
}

// POST /api/erp/notifications - mark all as read
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'OWNER') return NextResponse.json({ ok: true })

  await db.notification.updateMany({
    where: {
      tenantId: user.tenantId,
      OR: [{ userId: user.id }, { userId: null }],
      read: false,
    },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
