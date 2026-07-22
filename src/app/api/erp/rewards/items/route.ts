import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// GET /api/erp/rewards/items — list all items (admin)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const items = await db.rewardItem.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  })

  return NextResponse.json({ items })
}

// POST /api/erp/rewards/items — create a new reward item (admin)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, description, pointsCost, imageUrl, stock, isActive } = body

    if (!name || pointsCost == null) {
      return NextResponse.json({ error: 'Name and points cost are required' }, { status: 400 })
    }

    const item = await db.rewardItem.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        pointsCost: parseInt(pointsCost) || 0,
        imageUrl: imageUrl || null,
        stock: stock != null ? parseInt(stock) : -1,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'create',
      entityType: 'reward_item',
      entityId: item.id,
      entityName: item.name,
      summary: `Created reward item "${item.name}" (${item.pointsCost} points)`,
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
