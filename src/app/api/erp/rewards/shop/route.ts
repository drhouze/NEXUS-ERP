import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/rewards/shop — list active reward items for the tenant
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  // Fetch fresh points from DB
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { points: true } })

  const items = await db.rewardItem.findMany({
    where: {
      tenantId: user.tenantId,
      isActive: true,
    },
    orderBy: { pointsCost: 'asc' },
  })

  return NextResponse.json({ items, userPoints: dbUser?.points || 0 })
}
