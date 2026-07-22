import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const transactions = await db.transaction.findMany({
    where: filter,
    orderBy: { date: 'desc' },
    take: 200,
  })

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = totalIncome - totalExpenses

  const categoryBreakdown = new Map<string, { type: string; amount: number; count: number }>()
  for (const t of transactions) {
    const cur = categoryBreakdown.get(t.category) || { type: t.type, amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count += 1
    categoryBreakdown.set(t.category, cur)
  }

  const monthly: { month: string; income: number; expense: number; net: number }[] = []
  const now = new Date()
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
    transactions,
    categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([category, v]) => ({ category, ...v })),
    monthly,
    summary: {
      total: transactions.length,
      totalIncome,
      totalExpenses,
      netProfit,
      profitMargin: totalIncome ? (netProfit / totalIncome) * 100 : 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'finance')) {
    return NextResponse.json({ error: 'Only tenant admins and owners can create transactions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { type, category, amount, description, date, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!type || !category || amount == null || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Type must be income or expense' }, { status: 400 })
    }

    const transaction = await db.transaction.create({
      data: {
        tenantId, type, category, amount: parseFloat(amount),
        description, date: date ? new Date(date) : new Date(), refType: 'other',
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'transaction',
      entityId: transaction.id,
      entityName: transaction.description,
      summary: `Recorded ${type} of $${transaction.amount} in ${category}`,
    })

    return NextResponse.json({ transaction })
  } catch (e: any) {
    console.error('Create transaction error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
