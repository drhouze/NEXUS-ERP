import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/platform/coins-audit — all Nex Coin transactions across ALL tenants (OWNER only)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Platform owner only' }, { status: 403 })
  }

  // Fetch all point transactions across all tenants
  const transactions = await db.pointTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      // Include user name for display
    },
  })

  // Fetch all tenants with their coin balances
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true, nexCoins: true },
    orderBy: { name: 'asc' },
  })

  // Fetch user names for the transactions
  const userIds = Array.from(new Set(transactions.map(t => t.userId)))
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, tenantId: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))
  const tenantMap = new Map(tenants.map(t => [t.id, t.name]))

  const enrichedTransactions = transactions.map(t => {
    const u = userMap.get(t.userId)
    return {
      ...t,
      userName: u?.name || 'Unknown',
      userEmail: u?.email || '',
      tenantName: tenantMap.get(t.tenantId) || t.tenantId,
    }
  })

  return NextResponse.json({
    transactions: enrichedTransactions,
    tenants,
    summary: {
      totalTransactions: transactions.length,
      totalEarned: transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      totalSpent: transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
      totalCompanyBalance: tenants.reduce((s, t) => s + (t.nexCoins || 0), 0),
    },
  })
}
