'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard } from './shared'
import { formatCurrency, formatNumber } from './lib'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, DollarSign, Package, Users, Award, BarChart3 } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Legend, Line, LineChart, ComposedChart, Pie, PieChart, Cell,
} from 'recharts'

interface ReportsData {
  salesByCategory: { category: string; revenue: number }[]
  salesByDay: { date: string; revenue: number; orders: number; cost: number }[]
  turnover: { name: string; sku: string; sold: number; ordered: number; stock: number; turnoverRate: number; revenue: number; profit: number }[]
  topCustomers: { name: string; company: string; totalSpent: number; orderCount: number; avgOrderValue: number }[]
  orderStatusDist: Record<string, number>
  monthly: { month: string; income: number; expense: number; net: number }[]
  summary: { totalRevenue: number; totalProfit: number; avgOrderValue: number; inventoryValue: number }
}

const CAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#3b82f6', '#ec4899']

export function ReportsModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<ReportsData | null>(null)

  useEffect(() => {
    fetch('/api/erp/reports').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue" value={formatCurrency(data.summary.totalRevenue, { compact: true })} icon={DollarSign} accent="emerald" />
        <KpiCard label="Gross Profit" value={formatCurrency(data.summary.totalProfit, { compact: true })} icon={TrendingUp} accent="indigo" hint="Revenue - COGS" />
        <KpiCard label="Avg Order Value" value={formatCurrency(data.summary.avgOrderValue)} icon={BarChart3} accent="purple" />
        <KpiCard label="Inventory Value" value={formatCurrency(data.summary.inventoryValue, { compact: true })} icon={Package} accent="amber" />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Trends</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Turnover</TabsTrigger>
          <TabsTrigger value="customers">Top Customers</TabsTrigger>
          <TabsTrigger value="financial">Financials</TabsTrigger>
        </TabsList>

        {/* Sales Trends */}
        <TabsContent value="sales" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold">Revenue vs Cost - Last 30 Days</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily revenue and cost of goods sold</p>
            </div>
            <div className="p-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.salesByDay}>
                  <defs>
                    <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.slice(5)} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any, n: any) => [formatCurrency(v), n === 'revenue' ? 'Revenue' : 'Cost']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revArea)" />
                  <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h3 className="font-semibold">Revenue by Category</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Product category breakdown</p>
              </div>
              <div className="p-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.salesByCategory}
                      dataKey="revenue"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      label={(e: any) => `${e.category}`}
                      labelLine={false}
                    >
                      {data.salesByCategory.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h3 className="font-semibold">Revenue by Category</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Bar comparison</p>
              </div>
              <div className="p-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.salesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory Turnover */}
        <TabsContent value="inventory" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold">Inventory Turnover Rate</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Units sold / current stock - higher = faster-moving</p>
            </div>
            <div className="p-4 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.turnover.slice(0, 12).map(t => ({
                  name: t.name.length > 16 ? t.name.slice(0, 14) + '…' : t.name,
                  sold: t.sold,
                  stock: t.stock,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sold" name="Units Sold" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stock" name="Current Stock" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SectionCard title="Product Performance" subtitle="Revenue and profit per product">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="pb-2 pr-4 font-medium">Product</th>
                    <th className="pb-2 pr-4 font-medium">SKU</th>
                    <th className="pb-2 pr-4 font-medium text-right">Sold</th>
                    <th className="pb-2 pr-4 font-medium text-right">Stock</th>
                    <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                    <th className="pb-2 pr-4 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.turnover.map((t) => (
                    <tr key={t.sku} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{t.name}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{t.sku}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{t.sold}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{t.stock}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatCurrency(t.revenue)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-emerald-600 font-medium">{formatCurrency(t.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Top Customers */}
        <TabsContent value="customers" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold">Customer Lifetime Value</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Total spend per customer</p>
            </div>
            <div className="p-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCustomers.slice(0, 10).map(c => ({
                  name: c.company.length > 14 ? c.company.slice(0, 12) + '…' : c.company,
                  spent: c.totalSpent,
                  orders: c.orderCount,
                }))} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Lifetime Spend']} />
                  <Bar dataKey="spent" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SectionCard title="Top Customers Leaderboard" subtitle="Ranked by lifetime value">
            <div className="space-y-2">
              {data.topCustomers.map((c, i) => (
                <div key={c.company} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.company}</p>
                    <p className="text-xs text-muted-foreground">{c.name} · {c.orderCount} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatCurrency(c.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">avg {formatCurrency(c.avgOrderValue)}</p>
                  </div>
                  {i < 3 && <Award className="h-4 w-4 text-amber-500" />}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* Financials */}
        <TabsContent value="financial" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold">6-Month P&L Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Income, expenses, and net profit</p>
            </div>
            <div className="p-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="Net Profit" stroke="#6366f1" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold">Monthly P&L Summary</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tabular breakdown</p>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="pb-2 pr-4 font-medium">Month</th>
                    <th className="pb-2 pr-4 font-medium text-right">Income</th>
                    <th className="pb-2 pr-4 font-medium text-right">Expense</th>
                    <th className="pb-2 pr-4 font-medium text-right">Net Profit</th>
                    <th className="pb-2 pr-4 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => {
                    const margin = m.income > 0 ? (m.net / m.income) * 100 : 0
                    return (
                      <tr key={m.month} className="border-b border-border/40 last:border-0">
                        <td className="py-3 pr-4 font-medium">{m.month}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-emerald-600">{formatCurrency(m.income)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-rose-600">{formatCurrency(m.expense)}</td>
                        <td className={`py-3 pr-4 text-right tabular-nums font-medium ${m.net >= 0 ? 'text-foreground' : 'text-rose-600'}`}>{formatCurrency(m.net)}</td>
                        <td className={`py-3 pr-4 text-right tabular-nums ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{margin.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
