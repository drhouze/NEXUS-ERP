import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/rewards/balance — current user's points balance + recent transactions
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  // Get-or-create reward config
  let config = await db.rewardConfig.findUnique({ where: { tenantId: user.tenantId } })
  if (!config) {
    config = await db.rewardConfig.create({ data: { tenantId: user.tenantId } })
  }

  // Fetch fresh points from DB (JWT doesn't carry points)
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { points: true } })

  const transactions = await db.pointTransaction.findMany({
    where: { tenantId: user.tenantId, userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const redemptions = await db.rewardRedemption.findMany({
    where: { tenantId: user.tenantId, userId: user.id },
    include: { item: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({
    tenantId: user.tenantId,
    points: dbUser?.points || 0,
    pointsLabel: config.pointsLabel,
    shopName: config.shopName,
    isEnabled: config.isEnabled,
    transactions,
    redemptions,
  })
}
