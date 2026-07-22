'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, relativeTime } from './lib'
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  Bar, BarChart, Cell, Pie, PieChart, Legend
} from 'recharts'
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, AlertTriangle,
  Activity as ActivityIcon, ArrowUpRight, Boxes, UserCheck, Truck, Building2
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRealtime } from '@/hooks/use-realtime'

interface DashboardData {
  kpis: {
    revenue: number; expenses: number; netProfit: number;
    totalProducts: number; lowStockCount: number;
    totalCustomers: number; activeCustomers: number;
    totalOrders: number; pendingOrders: number;
    totalEmployees: number; activeEmployees: number;
    totalSuppliers: number; openPOs: number;
  }
  lowStockProducts: any[]
  recentOrders: any[]
  activities: any[]
  salesByDay: { date: string; revenue: number; orders: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  orderStatusCounts: { status: string; _count: number }[]
}

const STATUS_COLORS_HEX: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#a855f7',
  delivered: '#10b981', cancelled: '#ef4444',
}

export function DashboardModule({ userRole = 'TENANT_ADMIN', tenantId }: { userRole?: string; tenantId?: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveIndicator, setLiveIndicator] = useState(false)

  // Real-time WebSocket connection
  const { isConnected, lastEvent } = useRealtime(tenantId || null)

  const loadData = () => fetch('/api/erp/dashboard')
    .then(r => r.json())
    .then(d => {
      // API may return an error object (e.g. {error:'Server error'}) — guard against
      // storing that as data, otherwise `kpis` is undefined and any access crashes.
      if (!d || d.error || !d.kpis) {
        setData(null)
        setError(d?.error || 'Failed to load dashboard data')
        setLoading(false)
        return
      }
      setData(d)
      setError(null)
      setLoading(false)
    })
    .catch(() => {
      setData(null)
      setError('Network error')
      setLoading(false)
    })

  useEffect(() => { loadData() }, [])

  // When a real-time event arrives, refresh data + show pulse
  useEffect(() => {
    if (lastEvent) {
      loadData()
      const t = setTimeout(() => setLiveIndicator(true), 0)
      const t2 = setTimeout(() => setLiveIndicator(false), 2000)
      return () => { clearTimeout(t); clearTimeout(t2) }
    }
  }, [lastEvent])

  if (loading) return <DashboardSkeleton />
  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <strong>Dashboard unavailable.</strong>
          <p className="mt-1 text-rose-600">{error || 'No data returned from server.'}</p>
          <button onClick={loadData} className="mt-2 text-xs underline hover:text-rose-800">Retry</button>
        </div>
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="space-y-6">
      {/* Live indicator */}
      <div className="flex items-center justify-end gap-2 -mb-2">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          <span className={`relative flex h-2 w-2 ${isConnected ? '' : 'opacity-30'}`}>
            {isConnected && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${liveIndicator ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? (liveIndicator ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-400'}`}></span>
          </span>
          {isConnected ? (liveIndicator ? 'Live update received' : 'Real-time connected') : 'Offline mode'}
        </span>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue" value={formatCurrency(kpis.revenue, { compact: true })} icon={DollarSign} accent="emerald" trend={{ value: '12.5%', direction: 'up' }} hint="Last 90 days" loading={loading} />
        <KpiCard label="Net Profit" value={formatCurrency(kpis.netProfit, { compact: true })} icon={TrendingUp} accent="indigo" trend={{ value: '8.2%', direction: 'up' }} hint="Revenue - Expenses" loading={loading} />
        <KpiCard label="Active Orders" value={formatNumber(kpis.pendingOrders)} icon={ShoppingCart} accent="amber" hint={`${kpis.totalOrders} total orders`} loading={loading} />
        <KpiCard label="Active Customers" value={formatNumber(kpis.activeCustomers)} icon={Users} accent="purple" hint={`${kpis.totalCustomers} total customers`} loading={loading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Daily revenue from delivered/shipped orders (last 30 days)</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesByDay}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.slice(5)} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Order Status</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution across pipeline</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.orderStatusCounts.map(s => ({ name: s.status, value: s._count }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.orderStatusCounts.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLORS_HEX[s.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Products" value={formatNumber(kpis.totalProducts)} icon={Package} accent="indigo" hint={`${kpis.lowStockCount} low stock`} loading={loading} />
        <KpiCard label="Suppliers" value={formatNumber(kpis.totalSuppliers)} icon={Building2} accent="blue" hint={`${kpis.openPOs} open POs`} loading={loading} />
        <KpiCard label="Employees" value={formatNumber(kpis.activeEmployees)} icon={UserCheck} accent="emerald" hint={`${kpis.totalEmployees} total`} loading={loading} />
        <KpiCard label="Open POs" value={formatNumber(kpis.openPOs)} icon={Truck} accent="amber" hint="Awaiting delivery" loading={loading} />
      </div>

      {/* Activity + Top Products + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Recent Activity" subtitle="Latest events across modules">
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-4">
              {data.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-indigo-50 p-1.5">
                    <ActivityIcon className="h-3 w-3 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SectionCard>

        <SectionCard title="Top Products" subtitle="By revenue">
          <div className="space-y-3">
            {data.topProducts.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No sales yet</p>}
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.revenue, { compact: true })}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Low Stock Alert" subtitle="Items needing reorder" action={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          <div className="space-y-3">
            {data.lowStockProducts.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">All stocked ✓</p>}
            {data.lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-50 text-rose-600">
                  <Boxes className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku} · {p.warehouse}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-rose-600 tabular-nums">{p.stockQty}</p>
                  <p className="text-xs text-muted-foreground">/ {p.reorderLevel}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Recent Orders */}
      <SectionCard title="Recent Orders" subtitle="Latest sales orders" action={<a className="text-xs text-indigo-600 hover:underline flex items-center gap-1" href="#"><span>View all</span><ArrowUpRight className="h-3 w-3" /></a>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 font-medium">Order</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 font-mono text-xs">{o.orderNumber}</td>
                  <td className="py-3">{o.customer.company}</td>
                  <td className="py-3"><StatusBadge status={o.status} /></td>
                  <td className="py-3 font-medium tabular-nums">{formatCurrency(o.total)}</td>
                  <td className="py-3 text-muted-foreground text-xs">{relativeTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 h-[120px] animate-pulse bg-muted/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 h-[380px] animate-pulse bg-muted/40" />
        <Card className="h-[380px] animate-pulse bg-muted/40" />
      </div>
    </div>
  )
}
