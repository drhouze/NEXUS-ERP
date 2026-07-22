import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { seedChartOfAccounts } from '@/lib/accounting'

// GET /api/erp/accounting/balance-sheet
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  await seedChartOfAccounts(tenantId)

  const assetAccounts = await db.account.findMany({ where: { tenantId, type: 'asset', isActive: true }, orderBy: { code: 'asc' } })
  const liabilityAccounts = await db.account.findMany({ where: { tenantId, type: 'liability', isActive: true }, orderBy: { code: 'asc' } })
  const equityAccounts = await db.account.findMany({ where: { tenantId, type: 'equity', isActive: true }, orderBy: { code: 'asc' } })

  // Calculate net income (revenue - expenses) to add to equity as Retained Earnings
  const revenueAccounts = await db.account.findMany({ where: { tenantId, type: 'revenue', isActive: true } })
  const expenseAccounts = await db.account.findMany({ where: { tenantId, type: 'expense', isActive: true } })
  const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0)
  const netIncome = totalRevenue - totalExpenses

  const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0)
  const totalEquity = equityAccounts.reduce((s, a) => s + a.balance, 0) + netIncome

  return NextResponse.json({
    assets: assetAccounts.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
    liabilities: liabilityAccounts.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
    equity: equityAccounts.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  })
}
