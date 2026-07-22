import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// GET /api/erp/users - list users in the current tenant
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'users')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetTenantId = url.searchParams.get('tenantId') || user.tenantId

  // OWNER: if no tenantId specified, return ALL users across all tenants
  // (the owner console shows all tenants, so user management should too)
  // TENANT_ADMIN: always scoped to their own tenant
  let filter: any
  if (user.role === 'OWNER') {
    filter = targetTenantId ? { tenantId: targetTenantId } : {}
  } else {
    filter = { tenantId: user.tenantId }
  }

  const users = await db.user.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      emailVerified: true, lastLoginAt: true, createdAt: true, tenantId: true,
      portalType: true, modulePermissions: true, points: true, customRoleId: true,
    },
  })

  return NextResponse.json({ users })
}

// POST /api/erp/users - create a new user (staff, supplier, or customer portal)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'users')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, password, role, portalType, modulePermissions, customRoleId, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Role validation — allow system roles + CUSTOM (with customRoleId)
    const finalRole = role || 'EMPLOYEE'
    if (!['TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'].includes(finalRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    // If CUSTOM role, must have a customRoleId
    if (finalRole === 'CUSTOM' && !customRoleId) {
      return NextResponse.json({ error: 'Custom role ID is required when role is CUSTOM' }, { status: 400 })
    }
    // Verify the custom role belongs to this tenant
    if (customRoleId) {
      const customRole = await db.role.findFirst({ where: { id: customRoleId, tenantId } })
      if (!customRole) return NextResponse.json({ error: 'Invalid custom role' }, { status: 400 })
    }

    // Portal type: 'staff' (default), 'supplier', 'customer'
    const finalPortalType = portalType || 'staff'

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) return NextResponse.json({ error: 'A user with that email already exists' }, { status: 400 })

    // Check seat limit for staff users (supplier/customer portal don't count against seats)
    if (finalPortalType === 'staff') {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
      const currentStaff = await db.user.count({ where: { tenantId, portalType: 'staff' } })
      if (tenant && currentStaff >= tenant.seats) {
        return NextResponse.json({ error: `Seat limit reached (${tenant.seats} seats). Upgrade plan to add more users.` }, { status: 400 })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: finalRole,
        tenantId,
        status: 'active',
        portalType: finalPortalType,
        modulePermissions: modulePermissions ? JSON.stringify(modulePermissions) : null,
        customRoleId: customRoleId || null,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      entityName: newUser.name,
      summary: `Created ${finalPortalType} user "${newUser.name}" (${newUser.email}) as ${finalRole}`,
      metadata: { email, role: finalRole, portalType: finalPortalType },
    })

    return NextResponse.json({
      ok: true,
      user: {
        id: newUser.id, email: newUser.email, name: newUser.name,
        role: newUser.role, status: newUser.status,
        portalType: newUser.portalType, createdAt: newUser.createdAt,
      },
    })
  } catch (e: any) {
    console.error('Create user error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
