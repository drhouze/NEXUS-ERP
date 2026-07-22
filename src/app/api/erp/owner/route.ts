import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
// auth replaced
// auth replaced

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  

  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenants = await db.tenant.findMany({
    include: {
      _count: { select: { users: true, products: true, customers: true, salesOrders: true, transactions: true } },
      users: { where: { role: 'TENANT_ADMIN' }, select: { id: true, email: true, name: true, role: true, status: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalUsers = tenants.reduce((s, t) => s + t._count.users, 0)
  const totalOrders = tenants.reduce((s, t) => s + t._count.salesOrders, 0)
  const totalProducts = tenants.reduce((s, t) => s + t._count.products, 0)

  // Aggregate revenue across all tenants
  const allTx = await db.transaction.findMany({ select: { type: true, amount: true } })
  const totalIncome = allTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = allTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // MRR by plan
  const PLAN_PRICES: Record<string, number> = { free: 0, starter: 49, pro: 199, enterprise: 499 }
  const mrr = tenants.reduce((s, t) => s + (PLAN_PRICES[t.plan] || 0) * t._count.users, 0)
  const arr = mrr * 12

  return NextResponse.json({
    tenants: tenants.map(t => ({
      id: t.id,
      name: t.name,
      industry: t.industry,
      plan: t.plan,
      status: t.status,
      seats: t.seats,
      createdAt: t.createdAt,
      counts: t._count,
      mrr: (PLAN_PRICES[t.plan] || 0) * t._count.users,
      adminUser: t.users[0] || null,
    })),
    summary: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === 'active').length,
      totalUsers,
      totalOrders,
      totalProducts,
      totalIncome,
      totalExpenses,
      mrr,
      arr,
    },
  })
}
