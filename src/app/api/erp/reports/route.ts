import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
// auth replaced
// auth replaced

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const [orders, products, transactions, customers] = await Promise.all([
    db.salesOrder.findMany({
      where: filter,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.product.findMany({ where: filter, include: { supplier: true, orderItems: true, poItems: true } }),
    db.transaction.findMany({ where: filter }),
    db.customer.findMany({ where: filter, include: { orders: true } }),
  ])

  // Sales by category
  const categorySales = new Map<string, number>()
  for (const o of orders) {
    for (const it of o.items) {
      const cur = categorySales.get(it.product.category) || 0
      categorySales.set(it.product.category, cur + it.qty * it.unitPrice)
    }
  }
  const salesByCategory = Array.from(categorySales.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // Sales by day (30 days)
  const salesByDay: { date: string; revenue: number; orders: number; cost: number }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter(o => o.createdAt.toISOString().slice(0, 10) === dayStr)
    const revenue = dayOrders.reduce((s, o) => s + o.total, 0)
    const cost = dayOrders.reduce((s, o) => s + o.items.reduce((cs, it) => cs + it.qty * it.product.cost, 0), 0)
    salesByDay.push({ date: dayStr, revenue, orders: dayOrders.length, cost })
  }

  // Inventory turnover
  const turnover = products.map(p => {
    const sold = p.orderItems.reduce((s, it) => s + it.qty, 0)
    const ordered = p.poItems.reduce((s, it) => s + it.qty, 0)
    return {
      name: p.name,
      sku: p.sku,
      sold,
      ordered,
      stock: p.stockQty,
      turnoverRate: p.stockQty > 0 ? sold / p.stockQty : sold,
      revenue: sold * p.price,
      profit: sold * (p.price - p.cost),
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // Top customers
  const topCustomers = customers
    .map(c => ({
      name: c.name,
      company: c.company,
      totalSpent: c.totalSpent,
      orderCount: c.orders.length,
      avgOrderValue: c.orders.length ? c.totalSpent / c.orders.length : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)

  const orderStatusDist = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const monthly: { month: string; income: number; expense: number; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const monthTx = transactions.filter(t => {
      const td = new Date(t.date)
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear()
    })
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    monthly.push({ month: monthStr, income, expense, net: income - expense })
  }

  return NextResponse.json({
    salesByCategory,
    salesByDay,
    turnover,
    topCustomers,
    orderStatusDist,
    monthly,
    summary: {
      totalRevenue: orders.reduce((s, o) => s + o.total, 0),
      totalProfit: turnover.reduce((s, t) => s + t.profit, 0),
      avgOrderValue: orders.length ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0,
      inventoryValue: products.reduce((s, p) => s + p.price * p.stockQty, 0),
    },
  })
}
