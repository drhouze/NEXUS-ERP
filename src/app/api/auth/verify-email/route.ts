import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auth/verify-email - request email verification (sends token)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId } = body

    // Get current user from session
    const cookieStore = await (await import('next/headers')).cookies()
    const token = cookieStore.get('nexus_session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { getCurrentUser } = await import('@/lib/session')
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const crypto = await import('crypto')
    const verifyToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await db.emailVerificationToken.create({
      data: { userId: user.id, token: verifyToken, expiresAt },
    })

    // In production: email this link. In demo: return it.
    return NextResponse.json({
      ok: true,
      verifyLink: `/verify-email?token=${verifyToken}`,
      message: `Verification link generated. In production this would be emailed to ${user.email}.`,
    })
  } catch (e: any) {
    console.error('Request verify error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/auth/verify-email - confirm verification with token
export async function PATCH(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const verifyToken = await db.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verifyToken || verifyToken.usedAt || verifyToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: verifyToken.userId }, data: { emailVerified: new Date() } })
      await tx.emailVerificationToken.update({ where: { id: verifyToken.id }, data: { usedAt: new Date() } })
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Verify email error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
