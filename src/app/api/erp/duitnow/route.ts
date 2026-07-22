import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/duitnow - get DuitNow settings for tenant
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let settings = await db.duitNowSettings.findUnique({ where: { tenantId } })

  // Auto-create default settings if none exist
  if (!settings) {
    settings = await db.duitNowSettings.create({ data: { tenantId } })
  }

  // Don't expose API secret in full — mask it
  const maskedSettings = {
    ...settings,
    apiSecret: settings.apiSecret ? '••••••••' + settings.apiSecret.slice(-4) : null,
  }

  return NextResponse.json({ settings: maskedSettings })
}

// PATCH - update DuitNow merchant settings
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const updates: any = {}

    if (body.merchantId !== undefined) updates.merchantId = body.merchantId || null
    if (body.apiKey !== undefined) updates.apiKey = body.apiKey || null
    if (body.apiSecret !== undefined && body.apiSecret !== '' && !body.apiSecret.startsWith('••••')) {
      updates.apiSecret = body.apiSecret
    }
    if (body.isLive !== undefined) updates.isLive = body.isLive
    if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl || null
    if (body.displayName !== undefined) updates.displayName = body.displayName
    if (body.isActive !== undefined) updates.isActive = body.isActive

    const settings = await db.duitNowSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...updates },
      update: updates,
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'update', entityType: 'tenant', summary: 'Updated DuitNow payment settings',
    })

    return NextResponse.json({ settings: { ...settings, apiSecret: settings.apiSecret ? '••••••••' + settings.apiSecret.slice(-4) : null } })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
