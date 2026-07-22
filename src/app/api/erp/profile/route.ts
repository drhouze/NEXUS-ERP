import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// GET /api/erp/profile — current user's profile
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch fresh from DB to get the latest points balance (JWT doesn't carry it)
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, tenantId: true, status: true, points: true, twoFactorEnabled: true, lastLoginAt: true, createdAt: true },
  })

  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ user: dbUser })
}

// PATCH /api/erp/profile — update email and/or password
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { email, currentPassword, newPassword } = body
    const updates: any = {}

    // ---- Email update ----
    if (email && email !== user.email) {
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
      updates.email = email
    }

    // ---- Password update ----
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password' }, { status: 400 })
      }
      // Fetch the actual password hash from DB (JWT doesn't carry it)
      const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { password: true } })
      if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      const valid = bcrypt.compareSync(currentPassword, dbUser.password)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }
      updates.password = bcrypt.hashSync(newPassword, 10)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes to save' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: updates,
      select: { id: true, email: true, name: true, role: true, points: true },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId || '' },
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      entityName: user.email,
      summary: `Updated own profile: ${Object.keys(updates).join(', ')}`,
    })

    return NextResponse.json({ user: updated })
  } catch (e: any) {
    console.error('Profile update error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
