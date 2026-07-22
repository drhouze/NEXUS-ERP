import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
// auth replaced
// auth replaced

// GET /api/erp/dashboard - aggregated KPIs and recent activity (tenant-scoped)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const tenantId = user.tenantId

  // OWNER sees cross-tenant aggregate; others see only their tenant
  const tenantFilter = user.role === 'OWNER' ? {} : { tenantId }

  const [
    totalProducts,
    lowStockProducts,
    totalCustomers,
    activeCustomers,
    totalOrders,
    pendingOrders,
    totalEmployees,
    activeEmployees,
    totalSuppliers,
    openPOs,
    transactions,
    recentOrders,
    activities,
    salesByDay,
    topProducts,
  ] = await Promise.all([
    db.product.count({ where: tenantFilter }),
    db.product.findMany({ where: { ...tenantFilter, stockQty: { lte: db.product.fields.reorderLevel }, productType: { not: 'service' } }, include: { supplier: true }, take: 5 }),
    db.customer.count({ where: tenantFilter }),
    db.customer.count({ where: { ...tenantFilter, status: 'active' } }),
    db.salesOrder.count({ where: tenantFilter }),
    db.salesOrder.count({ where: { ...tenantFilter, status: { in: ['pending', 'processing'] } } }),
    db.employee.count({ where: tenantFilter }),
    db.employee.count({ where: { ...tenantFilter, status: 'active' } }),
    db.supplier.count({ where: tenantFilter }),
    db.purchaseOrder.count({ where: { ...tenantFilter, status: { in: ['draft', 'sent'] } } }),
    db.transaction.findMany({ where: tenantFilter, orderBy: { date: 'desc' }, take: 500 }),
    db.salesOrder.findMany({
      where: tenantFilter,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    db.activity.findMany({ where: tenantFilter, orderBy: { createdAt: 'desc' }, take: 8 }),
    aggregateSalesByDay(tenantFilter, tenantId || undefined),
    aggregateTopProducts(tenantFilter, tenantId || undefined),
  ])

  const revenue = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = revenue - expenses

  const orderStatusCounts = await db.salesOrder.groupBy({ by: ['status'], where: tenantFilter, _count: true })

  return NextResponse.json({
    kpis: {
      revenue, expenses, netProfit,
      totalProducts, lowStockCount: lowStockProducts.length,
      totalCustomers, activeCustomers,
      totalOrders, pendingOrders,
      totalEmployees, activeEmployees,
      totalSuppliers, openPOs,
    },
    lowStockProducts,
    recentOrders,
    activities,
    salesByDay,
    topProducts,
    orderStatusCounts,
    isOwnerView: user.role === 'OWNER',
  })
  } catch (e: any) {
    console.error('Dashboard API error:', e?.message, e?.stack)
    return NextResponse.json({ error: 'Server error', detail: e?.message }, { status: 500 })
  }
}

async function aggregateSalesByDay(filter: any, tenantId?: string) {
  // Resolve terminal statuses from the tenant's custom pipeline (fall back to defaults)
  let terminalStatuses: string[] = ['delivered', 'shipped']
  if (tenantId) {
    try {
      const { getTerminalOrderStatus, getOrderStatuses } = await import('@/lib/status-pipeline')
      const allStatuses = await getOrderStatuses(tenantId)
      const terminal = await getTerminalOrderStatus(tenantId)
      const terminalIdx = allStatuses.indexOf(terminal || '')
      if (terminalIdx >= 0) {
        terminalStatuses = allStatuses.filter((s, i) => i >= terminalIdx && s !== 'cancelled')
      }
    } catch {}
  }
  const orders = await db.salesOrder.findMany({
    where: { ...filter, status: { in: terminalStatuses } },
    select: { total: true, createdAt: true },
  })
  const days: { date: string; revenue: number; orders: number }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter(o => o.createdAt.toISOString().slice(0, 10) === dayStr)
    days.push({
      date: dayStr,
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
      orders: dayOrders.length,
    })
  }
  return days
}

async function aggregateTopProducts(filter: any, tenantId?: string) {
  // Only count revenue from terminal-status orders (exclude pending/cancelled)
  let terminalStatuses: string[] = ['delivered', 'shipped']
  if (tenantId) {
    try {
      const { getTerminalOrderStatus, getOrderStatuses } = await import('@/lib/status-pipeline')
      const allStatuses = await getOrderStatuses(tenantId)
      const terminal = await getTerminalOrderStatus(tenantId)
      const terminalIdx = allStatuses.indexOf(terminal || '')
      if (terminalIdx >= 0) {
        terminalStatuses = allStatuses.filter((s, i) => i >= terminalIdx && s !== 'cancelled')
      }
    } catch {}
  }
  const items = await db.salesOrderItem.findMany({
    where: { order: { ...filter, status: { in: terminalStatuses } } },
    include: { product: true },
  })
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const it of items) {
    const cur = map.get(it.productId) || { name: it.product.name, qty: 0, revenue: 0 }
    cur.qty += it.qty
    cur.revenue += it.qty * it.unitPrice
    map.set(it.productId, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
}
