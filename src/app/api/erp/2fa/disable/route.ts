import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// POST /api/erp/2fa/disable - disable 2FA (requires current TOTP code)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser?.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })
    }

    // Verify code (TOTP or backup code)
    const speakeasy = (await import('speakeasy')).default
    const bcrypt = (await import('bcryptjs')).default

    let valid = false

    // Try TOTP first
    if (dbUser.twoFactorSecret) {
      valid = speakeasy.totp({
        secret: dbUser.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      })
    }

    // Try backup code
    if (!valid && dbUser.twoFactorBackupCodes) {
      const hashedCodes: string[] = JSON.parse(dbUser.twoFactorBackupCodes)
      for (const hashed of hashedCodes) {
        if (await bcrypt.compare(code.toUpperCase(), hashed)) {
          valid = true
          // Remove used backup code
          const remaining = hashedCodes.filter(h => h !== hashed)
          await db.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: JSON.stringify(remaining) },
          })
          break
        }
      }
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId || undefined },
      action: 'update', entityType: 'user', entityId: user.id,
      summary: `2FA disabled for ${user.email}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
