import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getCrossTenantFeePercent } from '../route'

// GET /api/platform/settings/fee — public (any logged-in user)
// Returns the current cross-tenant redemption fee so the UI can display
// the conversion breakdown on the redemption screen.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fee = await getCrossTenantFeePercent()
  return NextResponse.json({
    enabled: fee.enabled,
    percent: fee.percent,
    description: 'A platform-wide fee that burns a percentage of points on cross-tenant redemptions to prevent inflation.',
  })
}
