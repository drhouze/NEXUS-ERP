import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createToken, setSessionCookie } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    })
    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if tenant is suspended (for non-OWNER users)
    if (user.tenant && user.tenant.status === 'suspended' && user.role !== 'OWNER') {
      return NextResponse.json({ error: `Tenant "${user.tenant.name}" is suspended. Contact the platform owner.` }, { status: 403 })
    }

    // Update lastLoginAt
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    // Audit log
    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId || undefined },
      action: 'login',
      entityType: 'auth',
      entityId: user.id,
      summary: `User ${user.email} logged in`,
    })

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      tenantId: user.tenantId || '',
      portalType: (user as any).portalType || 'staff',
      modulePermissions: (user as any).modulePermissions || null,
      customRoleId: (user as any).customRoleId || null,
    } as any)
    await setSessionCookie(token)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        tenantId: user.tenantId,
        portalType: (user as any).portalType || 'staff',
      },
    })
  } catch (e: any) {
    console.error('Login error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
