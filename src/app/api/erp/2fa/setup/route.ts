import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

// POST /api/erp/2fa/setup - generate secret + QR code
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Nexus ERP (${user.email})`,
      issuer: 'Nexus ERP',
      length: 32,
    })

    // Generate QR code data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

    // Generate 10 backup codes
    const backupCodes: string[] = []
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase())
    }

    // Temporarily store secret + hashed backup codes on user (not yet enabled)
    const hashedBackupCodes = JSON.stringify(backupCodes.map(c => bcrypt.hashSync(c, 10)))

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    })

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
      backupCodes, // Return raw codes ONCE - user must save them
    })
  } catch (e: any) {
    console.error('2FA setup error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
