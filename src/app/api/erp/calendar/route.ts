import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/calendar?month=2026-07 — returns orders + key dates for calendar view
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const monthParam = url.searchParams.get('month') // e.g. "2026-07"
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ events: [] })

  // Parse month range
  let startDate: Date, endDate: Date
  if (monthParam) {
    const [year, month] = monthParam.split('-').map(Number)
    startDate = new Date(year, month - 1, 1)
    endDate = new Date(year, month, 0, 23, 59, 59)
  } else {
    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
  }

  const filter = user.role === 'OWNER' ? {} : { tenantId }
  const dateFilter = { ...filter, createdAt: { gte: startDate, lte: endDate } }

  // Get orders in this month
  const orders = await db.salesOrder.findMany({
    where: dateFilter,
    select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, customer: { select: { company: true } } },
  })

  // Get POs in this month
  const pos = await db.purchaseOrder.findMany({
    where: dateFilter,
    select: { id: true, poNumber: true, status: true, total: true, createdAt: true, supplier: { select: { name: true } } },
  })

  // Get transactions in this month
  const transactions = await db.transaction.findMany({
    where: dateFilter,
    select: { id: true, type: true, amount: true, description: true, date: true, category: true },
  })

  // Format as calendar events
  const events = [
    ...orders.map(o => ({
      id: o.id,
      type: 'order',
      title: `${o.orderNumber} — ${o.customer.company}`,
      date: o.createdAt.toISOString().slice(0, 10),
      time: o.createdAt.toTimeString().slice(0, 5),
      status: o.status,
      amount: o.total,
      link: `/docs/invoice/${o.id}`,
    })),
    ...pos.map(p => ({
      id: p.id,
      type: 'po',
      title: `${p.poNumber} — ${p.supplier.name}`,
      date: p.createdAt.toISOString().slice(0, 10),
      time: p.createdAt.toTimeString().slice(0, 5),
      status: p.status,
      amount: p.total,
    })),
    ...transactions.map(t => ({
      id: t.id,
      type: t.type,
      title: t.description,
      date: t.date.toISOString().slice(0, 10),
      time: t.date.toTimeString().slice(0, 5),
      amount: t.amount,
      category: t.category,
    })),
  ]

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  return NextResponse.json({
    events,
    month: monthParam || `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
    stats: {
      orders: orders.length,
      pos: pos.length,
      transactions: transactions.length,
      revenue: transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    },
  })
}
