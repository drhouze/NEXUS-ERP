import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { logAction } from '@/lib/audit'

// POST /api/auth/reset-password - reset password with token
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json()
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } })
      await tx.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } })
    })

    await logAction({
      ctx: { actorEmail: resetToken.user.email, actorRole: resetToken.user.role, tenantId: resetToken.user.tenantId || undefined },
      action: 'reset_password',
      entityType: 'auth',
      entityId: resetToken.userId,
      summary: `Password reset completed for ${resetToken.user.email}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Reset password error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
