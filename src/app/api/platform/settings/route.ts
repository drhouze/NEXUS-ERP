import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// Default platform settings
const DEFAULTS: Record<string, { value: string; description: string }> = {
  crossTenantFeePercent: {
    value: '10',
    description: 'Percentage of points burned (removed from circulation) on every cross-tenant redemption. Prevents point inflation in the circular economy. 0 = no fee, 100 = full burn (shop owner gets nothing).',
  },
  crossTenantFeeEnabled: {
    value: 'true',
    description: 'Whether the cross-tenant redemption fee is active.',
  },
}

/** Get a platform setting (with default fallback). */
export async function getPlatformSetting(key: string): Promise<string> {
  const row = await db.platformSetting.findUnique({ where: { key } })
  return row?.value ?? DEFAULTS[key]?.value ?? ''
}

/** Get the cross-tenant fee percentage (0-100). */
export async function getCrossTenantFeePercent(): Promise<{ enabled: boolean; percent: number }> {
  const [enabledStr, percentStr] = await Promise.all([
    getPlatformSetting('crossTenantFeeEnabled'),
    getPlatformSetting('crossTenantFeePercent'),
  ])
  return {
    enabled: enabledStr !== 'false',
    percent: Math.min(100, Math.max(0, parseFloat(percentStr) || 0)),
  }
}

// GET /api/platform/settings — list all platform settings (OWNER only)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Platform owner only' }, { status: 403 })
  }

  // Ensure all default settings exist
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const existing = await db.platformSetting.findUnique({ where: { key } })
    if (!existing) {
      await db.platformSetting.create({ data: { key, value: def.value, description: def.description } })
    }
  }

  const settings = await db.platformSetting.findMany()
  return NextResponse.json({ settings })
}

// PATCH /api/platform/settings — update a platform setting (OWNER only)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Platform owner only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { key, value } = body
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    const def = DEFAULTS[key]
    const updated = await db.platformSetting.upsert({
      where: { key },
      create: { key, value: String(value), description: def?.description },
      update: { value: String(value), updatedBy: user.id },
    })

    return NextResponse.json({ setting: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
