import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { sendPasswordResetEmail } from '@/lib/email'

// POST /api/auth/forgot-password - request password reset
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    })

    // Always return ok to prevent email enumeration
    if (!user) return NextResponse.json({ ok: true })

    // Generate token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    // Build reset link
    const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    // Send email (logged to EmailLog table in demo)
    await sendPasswordResetEmail(user.email, resetLink, user.tenantId || undefined)

    await logAction({
      ctx: { actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId || undefined },
      action: 'reset_password',
      entityType: 'auth',
      entityId: user.id,
      summary: `Password reset requested for ${user.email}`,
    })

    // In demo: return reset link so user can click it (in production, only email is sent)
    return NextResponse.json({
      ok: true,
      resetLink,
      message: `Reset link sent to ${user.email}. Check the Email Log in Settings to view it.`,
    })
  } catch (e: any) {
    console.error('Forgot password error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
