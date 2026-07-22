import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * POST /api/erp/rewards/adjust
 * Body: { userId, amount, reason, taskId? }
 *
 * Admin manually adjusts a user's points.
 *   amount > 0 → award points (e.g. monthly bonus, referral, custom task)
 *   amount < 0 → deduct points (e.g. correction, penalty)
 *
 * If taskId is provided, the task's points override the amount (for task-based awards).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { userId: targetUserId, amount: rawAmount, reason, taskId } = body

    if (!targetUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, points: true, tenantId: true },
    })
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (targetUser.tenantId !== user.tenantId && user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Cannot adjust points for users in other tenants' }, { status: 403 })
    }

    // Determine the amount: use task points if taskId provided, otherwise the raw amount
    let amount = parseInt(rawAmount) || 0
    let description = reason || 'Manual adjustment'
    let triggerType = 'manual'

    if (taskId) {
      const task = await db.rewardTask.findFirst({
        where: { id: taskId, tenantId: user.tenantId },
      })
      if (task) {
        amount = task.points
        description = `Task: ${task.name}${reason ? ' — ' + reason : ''}`
        triggerType = task.triggerType
      }
    }

    if (amount === 0) {
      return NextResponse.json({ error: 'Amount must be non-zero' }, { status: 400 })
    }

    // Apply the adjustment
    const updated = await db.user.update({
      where: { id: targetUserId },
      data: { points: { increment: amount } },
    })

    // Record the transaction
    await db.pointTransaction.create({
      data: {
        tenantId: user.tenantId,
        userId: targetUserId,
        type: amount > 0 ? 'adjusted' : 'adjusted',
        amount,
        description,
        refType: 'admin_adjustment',
        refId: taskId || null,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'adjust_points',
      entityType: 'user',
      entityId: targetUserId,
      entityName: targetUser.name,
      summary: `${user.name} ${amount > 0 ? 'awarded' : 'deducted'} ${Math.abs(amount)} points ${amount > 0 ? 'to' : 'from'} ${targetUser.name}: ${description}`,
    })

    return NextResponse.json({
      ok: true,
      user: { id: updated.id, name: updated.name, points: updated.points },
      adjustment: { amount, description, triggerType },
    })
  } catch (e: any) {
    console.error('Adjust points error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
