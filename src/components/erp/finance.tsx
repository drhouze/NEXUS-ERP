'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, TrendingDown, Wallet, Search, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
import { TransactionForm } from './forms'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Legend, Pie, PieChart, Cell,
} from 'recharts'

interface FinanceData {
  transactions: any[]
  categoryBreakdown: { category: string; type: string; amount: number; count: number }[]
  monthly: { month: string; income: number; expense: number; net: number }[]
  summary: {
    total: number; totalIncome: number; totalExpenses: number;
    netProfit: number; profitMargin: number;
  }
}

export function FinanceModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<FinanceData | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)

  // Only TENANT_ADMIN can add transactions (MANAGER has view-only Finance)
  const canAdd = userRole === 'OWNER' || userRole === 'TENANT_ADMIN'

  const loadData = () => fetch('/api/erp/transactions').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.transactions.filter(t =>
      (t.description.toLowerCase().includes(search.toLowerCase()) ||
       t.category.toLowerCase().includes(search.toLowerCase())) &&
      (type === 'all' || t.type === type)
    )
  }, [data, search, type])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  const expenseCategories = data.categoryBreakdown.filter(c => c.type === 'expense').sort((a, b) => b.amount - a.amount)
  const incomeCategories = data.categoryBreakdown.filter(c => c.type === 'income').sort((a, b) => b.amount - a.amount)

  const EXP_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Income" value={formatCurrency(data.summary.totalIncome, { compact: true })} icon={ArrowUpRight} accent="emerald" />
        <KpiCard label="Total Expenses" value={formatCurrency(data.summary.totalExpenses, { compact: true })} icon={ArrowDownRight} accent="rose" />
        <KpiCard label="Net Profit" value={formatCurrency(data.summary.netProfit, { compact: true })} icon={Wallet} accent="indigo" trend={{ value: `${data.summary.profitMargin.toFixed(1)}%`, direction: data.summary.profitMargin > 0 ? 'up' : 'down' }} hint="Profit margin" />
        <KpiCard label="Transactions" value={formatNumber(data.summary.total)} icon={DollarSign} accent="purple" />
      </div>

      {/* P&L chart */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Profit & Loss - Last 6 Months</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly income vs expenses</p>
        </div>
        <div className="p-4 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthly}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v: any, n: any) => [formatCurrency(v), n === 'income' ? 'Income' : 'Expense']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Expense Breakdown</h3>
            <p className="text-xs text-muted-foreground mt-0.5">By category</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories.map(c => ({ name: c.category, value: c.amount }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {expenseCategories.map((_, i) => (
                    <Cell key={i} fill={EXP_COLORS[i % EXP_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Top Expense Categories</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ranked by amount</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseCategories.slice(0, 6).map(c => ({
                name: c.category.length > 12 ? c.category.slice(0, 10) + '…' : c.category,
                amount: c.amount,
              }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Amount']} />
                <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Transactions table */}
      <SectionCard
        title="Transactions"
        subtitle={`${filtered.length} of ${data.transactions.length} transactions`}
        action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Transaction</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-5 px-5 max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Description</th>
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-4 text-muted-foreground text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="py-3 pr-4 font-medium">{t.description}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.category}</td>
                  <td className="py-3 pr-4"><StatusBadge status={t.type} /></td>
                  <td className={`py-3 pr-4 font-medium tabular-nums text-right ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No transactions match your filters</div>
          )}
        </div>
      </SectionCard>

      {canAdd && <TransactionForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />}
    </div>
  )
}
