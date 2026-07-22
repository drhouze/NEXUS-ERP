import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// POST /api/erp/rewards/redeem — redeem a reward item (deduct points)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { itemId } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 })

    const item = await db.rewardItem.findFirst({
      where: { id: itemId, tenantId: user.tenantId, isActive: true },
    })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    // Check stock
    if (item.stock === 0) {
      return NextResponse.json({ error: 'Item is out of stock' }, { status: 400 })
    }

    // Check points balance (fetch fresh from DB — JWT doesn't carry points)
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { points: true } })
    const currentPoints = dbUser?.points || 0
    if (currentPoints < item.pointsCost) {
      return NextResponse.json({
        error: `Not enough points. You need ${item.pointsCost}, you have ${currentPoints}.`,
      }, { status: 400 })
    }

    // Deduct points + create redemption + record transaction
    const [updatedUser, redemption] = await Promise.all([
      db.user.update({
        where: { id: user.id },
        data: { points: { decrement: item.pointsCost } },
      }),
      db.rewardRedemption.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          itemId: item.id,
          pointsCost: item.pointsCost,
          status: 'pending',
        },
      }),
    ])

    // Decrement stock if not unlimited
    if (item.stock > 0) {
      await db.rewardItem.update({
        where: { id: item.id },
        data: { stock: { decrement: 1 } },
      })
    }

    // Record the point transaction
    await db.pointTransaction.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        type: 'spent',
        amount: -item.pointsCost,
        description: `Redeemed: ${item.name}`,
        refType: 'redemption',
        refId: redemption.id,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'redeem',
      entityType: 'reward_item',
      entityId: item.id,
      entityName: item.name,
      summary: `${user.name} redeemed "${item.name}" for ${item.pointsCost} points`,
    })

    return NextResponse.json({
      ok: true,
      redemption,
      remainingPoints: updatedUser.points,
    })
  } catch (e: any) {
    console.error('Redeem error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
