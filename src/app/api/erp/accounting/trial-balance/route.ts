import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { seedChartOfAccounts } from '@/lib/accounting'

// GET /api/erp/accounting/trial-balance
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  await seedChartOfAccounts(tenantId)

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  // For trial balance: show each account's balance in the appropriate column
  // Assets & expenses normally have debit balances; liabilities/equity/revenue have credit balances
  // If the balance is negative, it goes in the opposite column
  const rows = accounts.map(a => {
    const isDebitNormal = a.type === 'asset' || a.type === 'expense'
    const balance = a.balance
    if (isDebitNormal) {
      return {
        code: a.code, name: a.name, type: a.type,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
      }
    } else {
      return {
        code: a.code, name: a.name, type: a.type,
        debit: balance < 0 ? Math.abs(balance) : 0,
        credit: balance > 0 ? balance : 0,
      }
    }
  })

  const totalDebits = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredits = rows.reduce((s, r) => s + r.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  return NextResponse.json({ rows, totalDebits, totalCredits, isBalanced })
}
