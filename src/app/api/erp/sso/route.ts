import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const config = await db.ssoConfig.findUnique({ where: { tenantId } })
  return NextResponse.json({ config })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { provider, entityId, ssoUrl, certificate, isActive } = await req.json()

    const config = await db.ssoConfig.upsert({
      where: { tenantId },
      create: { tenantId, provider: provider || 'saml', entityId, ssoUrl, certificate, isActive: isActive ?? false },
      update: { provider: provider || 'saml', entityId, ssoUrl, certificate, isActive: isActive ?? false },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'update', entityType: 'tenant', entityId: tenantId,
      summary: `SSO config ${isActive ? 'enabled' : 'updated'} (${provider})`,
    })

    return NextResponse.json({ config })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
