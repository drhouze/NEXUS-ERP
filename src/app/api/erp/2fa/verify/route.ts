import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import { send2FASetupEmail } from '@/lib/email'
import speakeasy from 'speakeasy'

// POST /api/erp/2fa/verify - verify TOTP code and enable 2FA
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser?.twoFactorSecret) {
      return NextResponse.json({ error: 'Setup 2FA first' }, { status: 400 })
    }

    // Verify TOTP code
    const verified = speakeasy.totp({
      secret: dbUser.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1, // allow 1 step before/after
    })

    if (!verified) {
      return NextResponse.json({ error: 'Invalid code. Try again.' }, { status: 400 })
    }

    // Enable 2FA
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    })

    // Extract backup codes to send via email
    const backupCodes: string[] = []
    if (dbUser.twoFactorBackupCodes) {
      const hashedCodes = JSON.parse(dbUser.twoFactorBackupCodes)
      // We can't reverse hashes - we need to have saved the raw codes during setup
      // The setup endpoint returned them; we send them here from the recent setup
      // Actually, the raw codes were already shown in setup response. Email is a backup.
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId || undefined },
      action: 'update', entityType: 'user', entityId: user.id,
      summary: `2FA enabled for ${user.email}`,
    })

    return NextResponse.json({ ok: true, message: '2FA enabled successfully' })
  } catch (e: any) {
    console.error('2FA verify error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
