import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// POST /api/erp/tenants - create a new tenant + first admin user (OWNER only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only platform owners can create tenants' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { tenantName, industry, plan, seats, adminName, adminEmail, adminPassword } = body

    if (!tenantName || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Tenant name, admin name, email and password are required' }, { status: 400 })
    }
    if (adminPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const tenantId = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)

    const existingTenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (existingTenant) return NextResponse.json({ error: `Tenant "${tenantName}" already exists` }, { status: 400 })

    const existingUser = await db.user.findUnique({ where: { email: adminEmail.toLowerCase() } })
    if (existingUser) return NextResponse.json({ error: 'A user with that email already exists' }, { status: 400 })

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { id: tenantId, name: tenantName, industry: industry || 'General', plan: plan || 'starter', seats: parseInt(seats) || 10, status: 'active' },
      })
      const adminUser = await tx.user.create({
        data: { email: adminEmail.toLowerCase(), name: adminName, password: hashedPassword, role: 'TENANT_ADMIN', tenantId: tenant.id, status: 'active' },
      })
      return { tenant, adminUser }
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: result.tenant.id },
      action: 'create',
      entityType: 'tenant',
      entityId: result.tenant.id,
      entityName: result.tenant.name,
      summary: `Created tenant "${result.tenant.name}" (${result.tenant.plan} plan, ${result.tenant.seats} seats) with admin ${result.adminUser.email}`,
      metadata: { plan: result.tenant.plan, seats: result.tenant.seats, adminEmail: result.adminUser.email },
    })

    return NextResponse.json({
      ok: true,
      tenant: result.tenant,
      adminUser: { id: result.adminUser.id, email: result.adminUser.email, name: result.adminUser.name, role: result.adminUser.role },
      loginInfo: `Tenant "${result.tenant.name}" created. Admin can login at /login with ${result.adminUser.email}`,
    })
  } catch (e: any) {
    console.error('Create tenant error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
