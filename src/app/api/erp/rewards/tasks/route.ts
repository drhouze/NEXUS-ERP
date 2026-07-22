import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// GET /api/erp/rewards/tasks — list all reward tasks for the tenant
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const tasks = await db.rewardTask.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ triggerType: 'asc' }, { points: 'desc' }],
  })

  return NextResponse.json({ tasks })
}

// POST /api/erp/rewards/tasks — create a reward task (admin only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, description, points, triggerType, isActive } = body

    if (!name || points == null) {
      return NextResponse.json({ error: 'Name and points are required' }, { status: 400 })
    }

    const task = await db.rewardTask.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        points: parseInt(points) || 0,
        triggerType: triggerType || 'manual',
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })

    return NextResponse.json({ task })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
