import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { seedChartOfAccounts, DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/accounting'

// GET /api/erp/accounting/accounts - list chart of accounts
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  // Seed default accounts if none exist
  await seedChartOfAccounts(tenantId)

  const accounts = await db.account.findMany({
    where: { tenantId },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
    include: { _count: { select: { journalLines: true } } },
  })

  // Group by type
  const grouped: Record<string, any[]> = {}
  for (const acc of accounts) {
    if (!grouped[acc.type]) grouped[acc.type] = []
    grouped[acc.type].push(acc)
  }

  const totals: Record<string, number> = {}
  for (const [type, accs] of Object.entries(grouped)) {
    totals[type] = accs.reduce((s, a) => s + a.balance, 0)
  }

  return NextResponse.json({ accounts, grouped, totals })
}

// POST /api/erp/accounting/accounts - create custom account
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { code, name, type, subType } = await req.json()
    if (!code || !name || !type) return NextResponse.json({ error: 'Code, name, and type required' }, { status: 400 })

    const existing = await db.account.findUnique({ where: { tenantId_code: { tenantId, code } } })
    if (existing) return NextResponse.json({ error: 'Account code already exists' }, { status: 400 })

    const account = await db.account.create({
      data: { tenantId, code, name, type, subType: subType || null, isSystem: false },
    })

    return NextResponse.json({ account })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
