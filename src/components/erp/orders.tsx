'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DollarSign, ShoppingCart, TrendingUp, Clock, Search, Package, Plus, MoreVertical,
  ChevronRight, X, Copy, CreditCard, CheckCircle2, Loader2, FileText, Stethoscope,
  RotateCcw, AlertTriangle, MoreHorizontal,
} from 'lucide-react'
import { SalesOrderForm } from './forms'
import { EditDialog, EditField } from './edit-dialog'
import { EncounterDialog } from './encounter-dialog'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

interface EncounterTemplateShape {
  displayName?: string
  sections?: any[]
  itemTables?: any[]
  requiredSectionIds?: string[]
  requireEncounterBeforeInvoice?: boolean
  defaultDepositAmount?: number | null
  defaultDepositLabel?: string
}

interface OrdersData {
  orders: any[]
  statusCounts: { status: string; _count: number; _sum: { total: number | null } }[]
  summary: {
    total: number; totalRevenue: number; avgOrderValue: number;
    pending: number; processing: number; shipped: number; delivered: number; cancelled: number;
  }
  encounterTemplate?: EncounterTemplateShape | null
}

const DEFAULT_PIPELINE = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

function parseObj(v: any): any {
  if (!v) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return {} }
}

export function OrdersModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<OrdersData | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  // Tenant's custom order status pipeline (loaded from /api/erp/status-pipelines).
  const [customStatuses, setCustomStatuses] = useState<string[]>(DEFAULT_PIPELINE)

  const canAdd = true
  const canChangeStatus = userRole !== 'EMPLOYEE'

  const loadData = () => fetch('/api/erp/orders').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  // Fetch custom status pipeline
  useEffect(() => {
    fetch('/api/erp/status-pipelines')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.pipeline?.orderStatuses?.length) {
          // API returns [{value, label, color}], we need just the values
          const vals = d.pipeline.orderStatuses.map((s: any) => typeof s === 'string' ? s : s.value)
          setCustomStatuses(vals.length > 0 ? vals : DEFAULT_PIPELINE)
        }
      })
      .catch(() => {})
  }, [])

  // ---- Helpers operating on the loaded encounter template ----
  const encounterTemplate = data?.encounterTemplate

  /** Returns true when the tenant has configured any sections or item tables. */
  function hasServiceFormConfigured(): boolean {
    if (!encounterTemplate) return false
    const sections = parseArr(encounterTemplate.sections)
    const tables = parseArr(encounterTemplate.itemTables)
    return sections.length > 0 || tables.length > 0
  }

  /** Last non-cancelled status from customStatuses (= "Completed"). */
  function getTerminalStatus(): string | null {
    for (let i = customStatuses.length - 1; i >= 0; i--) {
      if (customStatuses[i] !== 'cancelled') return customStatuses[i]
    }
    return customStatuses[customStatuses.length - 1] || null
  }

  /**
   * Encounter gate. Returns {ok:true} when the order can advance to the
   * terminal status (or be invoiced). Otherwise returns {ok:false, reason}.
   */
  function checkEncounterGate(order: any): { ok: boolean; reason?: string } {
    if (!encounterTemplate?.requireEncounterBeforeInvoice) return { ok: true }
    if (!order.encounter) {
      return { ok: false, reason: 'A service form / encounter is required before invoicing.' }
    }
    const requiredIds = parseArr<string>(encounterTemplate.requiredSectionIds)
    if (requiredIds.length > 0) {
      const data = parseObj(order.encounter.data)
      const sectionValues: Record<string, any> = data.sectionValues || {}
      const missing = requiredIds.filter(sid => !sectionValues[sid] && sectionValues[sid] !== 0)
      if (missing.length > 0) {
        return { ok: false, reason: `Required service form sections are missing: ${missing.join(', ')}` }
      }
    }
    return { ok: true }
  }

  async function changeStatus(orderId: string, newStatus: string) {
    const order = data?.orders.find(o => o.id === orderId)
    if (order) {
      const terminal = getTerminalStatus()
      if (terminal && newStatus === terminal) {
        const gate = checkEncounterGate(order)
        if (!gate.ok) {
          alert(gate.reason || 'This action is blocked by the encounter gate.')
          return
        }
      }
    }
    const res = await fetch(`/api/erp/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) loadData()
  }

  async function duplicateOrder(orderId: string) {
    if (!confirm('Duplicate this order? A new order with the same line items will be created with status "pending".')) return
    const res = await fetch(`/api/erp/orders/${orderId}/duplicate`, { method: 'POST' })
    if (res.ok) loadData()
  }

  // ---- Payment dialog state ----
  const [paymentOrder, setPaymentOrder] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // ---- EditDialog + EncounterDialog state (declared before any early return) ----
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [encounterOrder, setEncounterOrder] = useState<any>(null)

  async function openPaymentDialog(order: any, opts?: { method?: string; amount?: string }) {
    setPaymentOrder(order)
    setPaymentError('')
    setPaymentMethod(opts?.method || 'cash')
    setPaymentRef('')
    const res = await fetch(`/api/erp/orders/${order.id}/payments`)
    if (res.ok) {
      const d = await res.json()
      setPayments(d.payments || [])
      if (opts?.amount) {
        setPaymentAmount(opts.amount)
      } else {
        const balance = d.balance
        setPaymentAmount(balance > 0 ? balance.toFixed(2) : '0.00')
      }
    }
  }

  async function submitPayment() {
    if (!paymentOrder) return
    setPaymentLoading(true); setPaymentError('')
    try {
      const res = await fetch(`/api/erp/orders/${paymentOrder.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount, method: paymentMethod, reference: paymentRef }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setPaymentOrder(null)
      loadData()
    } catch (e: any) { setPaymentError(e.message) } finally { setPaymentLoading(false) }
  }

  /** Open the payment dialog pre-filled for a refund of the surplus amount. */
  function refundSurplus(order: any) {
    const surplus = (order.paidAmount || 0) - order.total
    if (surplus <= 0.01) return
    openPaymentDialog(order, { method: 'refund', amount: surplus.toFixed(2) })
  }

  function getPaymentStatus(order: any): { label: string; color: string } {
    if (!order.paidAmount || order.paidAmount === 0) return { label: 'Unpaid', color: 'bg-rose-100 text-rose-700' }
    if (order.paidAmount >= order.total - 0.01) {
      // Distinguish "Paid" from "Overpaid".
      if (order.paidAmount > order.total + 0.01) return { label: 'Surplus', color: 'bg-amber-100 text-amber-700' }
      return { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' }
    }
    return { label: 'Partial', color: 'bg-amber-100 text-amber-700' }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    return data.orders.filter(o =>
      (o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
       o.customer.company.toLowerCase().includes(search.toLowerCase())) &&
      (status === 'all' || o.status === status)
    )
  }, [data, search, status])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  const pipeline = customStatuses.map(s => ({
    status: s,
    count: data.statusCounts.find(x => x.status === s)?._count || 0,
    total: data.statusCounts.find(x => x.status === s)?._sum.total || 0,
  }))

  const terminalStatus = getTerminalStatus()

  // ---- EditDialog field config ----
  const editFields: EditField[] = [
    { key: 'status', label: 'Status', type: 'select', options: customStatuses, required: true, halfWidth: true },
    { key: 'discountType', label: 'Discount Type', type: 'select', options: ['__none__', 'percentage', 'fixed'], halfWidth: true },
    { key: 'discountValue', label: 'Discount Value (% or amount)', type: 'number', halfWidth: true },
    { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', halfWidth: true },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional internal notes' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Orders" value={formatNumber(data.summary.total)} icon={ShoppingCart} accent="indigo" />
        <KpiCard label="Revenue (Booked)" value={formatCurrency(data.summary.totalRevenue, { compact: true })} icon={DollarSign} accent="emerald" hint="Shipped + delivered" />
        <KpiCard label="Avg Order Value" value={formatCurrency(data.summary.avgOrderValue)} icon={TrendingUp} accent="purple" />
        <KpiCard label="Pending" value={formatNumber(data.summary.pending + data.summary.processing)} icon={Clock} accent="amber" hint="Needs action" />
      </div>

      {/* Pipeline */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Order Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Orders grouped by status</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border/60">
          {pipeline.map(p => (
            <div key={p.status} className="p-5">
              <div className="flex items-center justify-between mb-1">
                <StatusBadge status={p.status} />
                <span className="text-2xl font-bold tabular-nums">{p.count}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(p.total, { compact: true })} total</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Status bar chart */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Revenue by Status</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Where revenue is concentrated</p>
        </div>
        <div className="p-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline.map(p => ({ name: p.status, revenue: p.total, orders: p.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(value: any) => [formatCurrency(value), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Orders table */}
      <SectionCard
        title="All Orders"
        subtitle={`${filtered.length} of ${data.orders.length} orders`}
        action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> New Order</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="w-full sm:w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {customStatuses.map(s => (
              <option key={s} value={s}>{s.replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto -mx-5 px-5 max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Order #</th>
                <th className="pb-2 pr-4 font-medium">Customer</th>
                <th className="pb-2 pr-4 font-medium">Items</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Payment</th>
                <th className="pb-2 pr-4 font-medium">Total</th>
                <th className="pb-2 pr-4 font-medium">Date</th>
                {canChangeStatus && <th className="pb-2 pr-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const payStatus = getPaymentStatus(o)
                const balance = o.total - (o.paidAmount || 0)
                const surplus = -balance // balance < 0 → surplus > 0
                const gate = checkEncounterGate(o)
                const isTerminal = terminalStatus && o.status === terminalStatus
                // Next status = pipeline entry after the current one (skipping cancelled).
                const curIdx = customStatuses.indexOf(o.status)
                const nextStatus = curIdx >= 0 && curIdx < customStatuses.length - 1 ? customStatuses[curIdx + 1] : null
                const canAdvance = !isTerminal && o.status !== 'cancelled' && !!nextStatus
                return (
                <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-4 font-mono text-xs">{o.orderNumber}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{o.customer.company}</div>
                    <div className="text-xs text-muted-foreground">{o.customer.name}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      {o.items.length} item{o.items.length > 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={o.status} />
                    {isTerminal && (
                      <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Completed</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-0.5">
                      <Badge className={payStatus.color + ' w-fit'}>{payStatus.label}</Badge>
                      {balance > 0.01 && (
                        <span className="text-[10px] text-rose-700">Bal: {formatCurrency(balance)}</span>
                      )}
                      {surplus > 0.01 && (
                        <span className="text-[10px] text-amber-700">Surplus: {formatCurrency(surplus)}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-medium tabular-nums">{formatCurrency(o.total)}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                  {canChangeStatus && (
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {/* Service form / encounter button (only if configured) */}
                        {hasServiceFormConfigured() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${!gate.ok ? 'animate-pulse text-amber-600' : 'text-muted-foreground'}`}
                            title={gate.ok ? 'Open service form' : 'Service form required — click to open'}
                            onClick={() => setEncounterOrder(o)}
                          >
                            <Stethoscope className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Payment button */}
                        {o.status !== 'cancelled' && balance > 0.01 && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openPaymentDialog(o)}>
                            <CreditCard className="h-3 w-3 mr-1" /> Payment
                          </Button>
                        )}

                        {/* Refund surplus button */}
                        {surplus > 0.01 && (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-amber-700" onClick={() => refundSurplus(o)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Refund
                          </Button>
                        )}

                        {/* Invoice button (gated by encounter) */}
                        <a href={`/docs/invoice/${o.id}`} target="_blank" rel="noopener">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${!gate.ok ? 'text-amber-600' : ''}`}
                            title={gate.ok ? 'View / Print Invoice' : 'Invoice locked — service form required'}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </a>

                        {/* Other documents dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Other documents">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={`/docs/quotation/${o.id}`} target="_blank" rel="noopener">View Quotation</a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/docs/receipt/${o.id}`} target="_blank" rel="noopener">View Receipt</a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/docs/delivery-note/${o.id}`} target="_blank" rel="noopener">View Delivery Note</a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingOrder(o)}>Edit Order…</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateOrder(o.id)}>Duplicate Order</DropdownMenuItem>
                            {hasServiceFormConfigured() && (
                              <DropdownMenuItem onClick={() => setEncounterOrder(o)}>
                                <Stethoscope className="h-3 w-3 mr-2" /> Open Service Form
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Status dropdown — show "Completed" when terminal */}
                        {isTerminal ? (
                          <Badge className="bg-emerald-100 text-emerald-700 h-7 px-2 inline-flex items-center">Completed</Badge>
                        ) : canAdvance ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                Advance <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => changeStatus(o.id, nextStatus!)}>
                                → Mark as {nextStatus!.replace(/\b\w/g, c => c.toUpperCase())}
                              </DropdownMenuItem>
                              {!gate.ok && (
                                <div className="px-2 py-1 text-[10px] text-amber-700 flex items-start gap-1">
                                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{gate.reason}</span>
                                </div>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600" onClick={() => changeStatus(o.id, 'cancelled')}>
                                <X className="h-3 w-3 mr-2" /> Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No orders match your filters</div>
          )}
        </div>
      </SectionCard>

      {/* Payment Dialog */}
      <Dialog open={!!paymentOrder} onOpenChange={(v) => !v && setPaymentOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentMethod === 'refund' ? <RotateCcw className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              {paymentMethod === 'refund' ? 'Issue Refund' : 'Receive Payment'}
            </DialogTitle>
            <DialogDescription>
              {paymentOrder && (
                <>Order <strong>{paymentOrder.orderNumber}</strong> · {paymentOrder.customer?.company} · Total: <strong>{formatCurrency(paymentOrder.total)}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          {paymentOrder && (() => {
            const balance = paymentOrder.total - (paymentOrder.paidAmount || 0)
            const surplus = -balance
            const isRefund = paymentMethod === 'refund'
            const isDeposit = paymentMethod === 'deposit'
            return (
              <div className="space-y-4">
                {/* 3-state balance display */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(paymentOrder.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-semibold tabular-nums text-emerald-600">{formatCurrency(paymentOrder.paidAmount || 0)}</p>
                  </div>
                  {balance > 0.01 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance Due</p>
                      <p className="font-semibold tabular-nums text-rose-600">{formatCurrency(balance)}</p>
                    </div>
                  ) : surplus > 0.01 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Surplus</p>
                      <p className="font-semibold tabular-nums text-amber-600">{formatCurrency(surplus)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-semibold tabular-nums text-emerald-600">Settled</p>
                    </div>
                  )}
                </div>

                {/* Existing payments */}
                {payments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Payment History</p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {payments.map((p: any) => {
                        const isDepositPmt = p.method === 'deposit'
                        const isRefundPmt = p.method === 'refund'
                        const badgeColor = isRefundPmt
                          ? 'bg-rose-100 text-rose-700'
                          : isDepositPmt
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded border border-border/60">
                            <div>
                              <span className={`font-medium tabular-nums ${isRefundPmt ? 'text-rose-700' : isDepositPmt ? 'text-indigo-700' : 'text-foreground'}`}>
                                {isRefundPmt ? '-' : ''}{formatCurrency(Math.abs(p.amount))}
                              </span>
                              <Badge className={`ml-2 text-[10px] ${badgeColor}`}>{p.method}</Badge>
                              {p.reference && <span className="text-muted-foreground ml-2">Ref: {p.reference}</span>}
                            </div>
                            <span className="text-muted-foreground">{formatDate(p.createdAt)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* New payment form */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount *</Label>
                    <Input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Method</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="tng">Touch 'n Go (TNG)</option>
                      <option value="duitnow">DuitNow QR</option>
                      <option value="deposit">Deposit (overpayment allowed)</option>
                      <option value="refund">Refund (returns money)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference (optional)</Label>
                  <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Check #, transaction ID, etc." />
                </div>

                {/* Quick amount buttons */}
                <div className="flex flex-wrap gap-2">
                  {!isRefund && balance > 0.01 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPaymentAmount(balance.toFixed(2))}>
                      Full Balance
                    </Button>
                  )}
                  {!isRefund && balance > 0.01 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPaymentAmount((balance / 2).toFixed(2))}>
                      50%
                    </Button>
                  )}
                  {/* Quick deposit from template default */}
                  {!isRefund && encounterTemplate?.defaultDepositAmount != null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPaymentMethod('deposit')
                        setPaymentAmount(String(encounterTemplate.defaultDepositAmount || 0))
                      }}
                    >
                      {encounterTemplate.defaultDepositLabel || 'Deposit'} ({formatCurrency(encounterTemplate.defaultDepositAmount || 0)})
                    </Button>
                  )}
                  {/* Quick refund of surplus */}
                  {surplus > 0.01 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-amber-700"
                      onClick={() => {
                        setPaymentMethod('refund')
                        setPaymentAmount(surplus.toFixed(2))
                      }}
                    >
                      Refund Surplus ({formatCurrency(surplus)})
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setPaymentAmount('')}>
                    Custom
                  </Button>
                </div>

                {isRefund && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-xs">
                      Refunds are stored as negative payments and create an expense transaction. They reduce the order's paid total.
                    </AlertDescription>
                  </Alert>
                )}

                {paymentError && <p className="text-sm text-rose-600">{paymentError}</p>}
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={paymentLoading || !paymentAmount}>
              {paymentLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : paymentMethod === 'refund' ? <RotateCcw className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {paymentMethod === 'refund' ? 'Issue Refund' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit order dialog */}
      <EditDialog
        open={!!editingOrder}
        onOpenChange={v => !v && setEditingOrder(null)}
        title={`Edit Order ${editingOrder?.orderNumber || ''}`}
        description="Update order status and notes. Line items can be edited from the invoice view."
        fields={editFields}
        initialData={editingOrder ? { status: editingOrder.status, notes: '' } : {}}
        size="sm"
        submitLabel="Save Changes"
        onSubmit={async (formData) => {
          if (!editingOrder) return
          const res = await fetch(`/api/erp/orders/${editingOrder.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: formData.status }),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || 'Failed to update order')
          }
          loadData()
        }}
      />

      {/* Encounter dialog */}
      <EncounterDialog
        orderId={encounterOrder?.id || ''}
        open={!!encounterOrder}
        onOpenChange={v => !v && setEncounterOrder(null)}
        onSaved={() => loadData()}
      />

      {canAdd && <SalesOrderForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />}
    </div>
  )
}
