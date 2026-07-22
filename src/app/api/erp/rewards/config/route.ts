import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// GET /api/erp/rewards/config — get reward config (admin)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let config = await db.rewardConfig.findUnique({ where: { tenantId: user.tenantId } })
  if (!config) {
    config = await db.rewardConfig.create({ data: { tenantId: user.tenantId } })
  }

  // All users with their points (for admin view)
  const users = await db.user.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, name: true, email: true, role: true, points: true, status: true },
    orderBy: { points: 'desc' },
  })

  return NextResponse.json({ config, users })
}

// PATCH /api/erp/rewards/config — update reward config (admin only)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.isEnabled !== undefined) updates.isEnabled = !!body.isEnabled
    if (body.pointsPerVisit !== undefined) updates.pointsPerVisit = parseInt(body.pointsPerVisit) || 10
    if (body.pointsLabel !== undefined) updates.pointsLabel = String(body.pointsLabel)
    if (body.shopName !== undefined) updates.shopName = String(body.shopName)

    const config = await db.rewardConfig.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, ...updates },
      update: updates,
    })

    return NextResponse.json({ config })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
