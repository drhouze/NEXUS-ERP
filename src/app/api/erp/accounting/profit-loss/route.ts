import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { seedChartOfAccounts } from '@/lib/accounting'

// GET /api/erp/accounting/profit-loss
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  await seedChartOfAccounts(tenantId)

  const revenueAccounts = await db.account.findMany({ where: { tenantId, type: 'revenue', isActive: true }, orderBy: { code: 'asc' } })
  const expenseAccounts = await db.account.findMany({ where: { tenantId, type: 'expense', isActive: true }, orderBy: { code: 'asc' } })

  const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0)
  const netIncome = totalRevenue - totalExpenses

  return NextResponse.json({
    revenue: revenueAccounts.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
    expenses: expenseAccounts.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
    totalRevenue,
    totalExpenses,
    netIncome,
  })
}
