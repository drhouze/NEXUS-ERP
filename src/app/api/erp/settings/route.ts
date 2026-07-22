import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/settings - get tenant settings
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role === 'OWNER') {
    return NextResponse.json({ isOwner: true })
  }

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const userCount = await db.user.count({ where: { tenantId: user.tenantId } })

  const PLAN_FEATURES: Record<string, any> = {
    free: { price: 0, maxSeats: 3, features: ['8 ERP modules', 'Up to 3 users', '1 warehouse', 'Basic reports', 'Community support'] },
    starter: { price: 49, maxSeats: 10, features: ['Everything in Free', 'Up to 10 users', 'Multi-warehouse', 'Tenant data backup', 'Email support'] },
    pro: { price: 199, maxSeats: 50, features: ['Everything in Starter', 'Up to 50 users', 'Advanced reports', 'Priority support', 'Custom branding'] },
    enterprise: { price: 499, maxSeats: 1000, features: ['Everything in Pro', 'Unlimited users', 'API access', 'Dedicated CSM', 'SSO & SAML', 'Custom integrations'] },
  }

  return NextResponse.json({
    tenant,
    userCount,
    seatsUsed: userCount,
    seatsAvailable: tenant.seats - userCount,
    planFeatures: PLAN_FEATURES[tenant.plan],
    allPlans: PLAN_FEATURES,
  })
}

// PATCH /api/erp/settings - upgrade plan / update tenant details
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const updates: any = {}
    let action = 'update'

    if (body.plan) {
      const PLAN_SEATS: Record<string, number> = { free: 3, starter: 10, pro: 50, enterprise: 1000 }
      updates.plan = body.plan
      updates.seats = PLAN_SEATS[body.plan] || tenant.seats
      action = 'upgrade'
    }
    if (body.name) updates.name = body.name
    if (body.industry) updates.industry = body.industry
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl
    if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor

    const updated = await db.tenant.update({ where: { id: tenantId }, data: updates })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action,
      entityType: 'tenant',
      entityId: tenantId,
      entityName: updated.name,
      summary: action === 'upgrade'
        ? `Upgraded tenant "${updated.name}" from ${tenant.plan} to ${updated.plan} plan (${updated.seats} seats)`
        : `Updated tenant settings for "${updated.name}"`,
      metadata: { before: { plan: tenant.plan, seats: tenant.seats }, after: { plan: updated.plan, seats: updated.seats } },
    })

    return NextResponse.json({ tenant: updated })
  } catch (e: any) {
    console.error('Update settings error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
