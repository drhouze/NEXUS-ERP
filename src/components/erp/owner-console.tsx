'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2, Users, DollarSign, Server, Crown, Plus, MoreVertical, Globe, Activity,
  Edit, Ban, CheckCircle, Trash2, Download, Play, AlertCircle,
} from 'lucide-react'
import { TenantForm } from './admin-forms'
import { EditTenantForm, SuspendTenantDialog, DeleteTenantDialog } from './manage-forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Pie, PieChart, Cell, Legend,
} from 'recharts'

interface OwnerConsoleProps {
  tenants: any[]
}

const PLAN_COLORS: Record<string, string> = {
  free: '#10b981',
  starter: '#94a3b8',
  pro: '#6366f1',
  enterprise: '#a855f7',
}
const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 49,
  pro: 199,
  enterprise: 499,
}

export function OwnerConsole({ tenants: initialTenants }: OwnerConsoleProps) {
  const [tenants, setTenants] = useState(initialTenants)
  const [stats, setStats] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Tenant row-action dialogs
  const [editTenant, setEditTenant] = useState<any>(null)
  const [suspendTenant, setSuspendTenant] = useState<any>(null)
  const [deleteTenant, setDeleteTenant] = useState<any>(null)

  const loadData = () => {
    fetch('/api/erp/owner').then(r => r.json()).then(d => {
      setStats(d)
      if (d?.tenants) setTenants(d.tenants)
    })
  }
  useEffect(() => { loadData() }, [])

  async function patchTenant(id: string, body: any) {
    setError(''); setSuccess('')
    const res = await fetch(`/api/erp/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); return false }
    setSuccess('Tenant updated successfully')
    loadData()
    return true
  }

  async function deleteTenantById(id: string) {
    setError(''); setSuccess('')
    const res = await fetch(`/api/erp/tenants/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); return }
    setSuccess('Tenant permanently deleted')
    loadData()
  }

  async function impersonateTenant(tenant: any) {
    if (!tenant.adminUser) {
      setError('No admin user found for this tenant')
      return
    }
    if (!confirm(`Login as ${tenant.adminUser.name} (${tenant.adminUser.email}) in ${tenant.name}? You can end impersonation anytime.`)) return
    setError('')
    const res = await fetch('/api/erp/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: tenant.adminUser.id }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); return }
    // Reload to enter impersonation mode
    setTimeout(() => { window.location.href = '/' }, 100)
  }

  function downloadTenantBackup(id: string) {
    window.open(`/api/erp/backup?tenantId=${id}`, '_blank')
  }

  const totalUsers = tenants.reduce((s, t) => s + (t._count?.users || t.counts?.users || 0), 0)
  const totalRevenue = tenants.reduce((s, t) => {
    const userCount = t._count?.users || t.counts?.users || 0
    return s + (PLAN_PRICES[t.plan] || 0) * userCount
  }, 0) * 12
  const totalOrders = tenants.reduce((s, t) => s + (t._count?.salesOrders || t.counts?.salesOrders || 0), 0)
  const totalProducts = tenants.reduce((s, t) => s + (t._count?.products || t.counts?.products || 0), 0)

  const planDistribution = ['free', 'starter', 'pro', 'enterprise'].map(plan => ({
    name: PLAN_LABELS[plan],
    value: tenants.filter(t => t.plan === plan).length,
    plan,
  }))

  const tenantsByData = [...tenants].sort((a, b) => {
    const aOrders = a._count?.salesOrders || a.counts?.salesOrders || 0
    const bOrders = b._count?.salesOrders || b.counts?.salesOrders || 0
    return bOrders - aOrders
  }).slice(0, 8)

  // Helper: tenant data comes in two shapes depending on whether it was loaded
  // from the server-side page render (with _count) or from the owner API (with counts)
  const getCount = (t: any, field: string) => t._count?.[field] ?? t.counts?.[field] ?? 0

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white border-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Platform Owner Console</span>
            </div>
            <h2 className="text-2xl font-bold">Welcome back, Platform Owner</h2>
            <p className="text-sm opacity-90 mt-1">You have full control over all tenants, subscriptions, and platform-wide settings.</p>
          </div>
          <Button className="bg-white text-orange-600 hover:bg-white/90 hidden sm:flex" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Tenant
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Tenants" value={formatNumber(tenants.filter(t => t.status === 'active').length)} icon={Building2} accent="indigo" hint={`${tenants.length} total`} />
        <KpiCard label="Total Users" value={formatNumber(totalUsers)} icon={Users} accent="emerald" hint="Across all tenants" />
        <KpiCard label="Annual MRR" value={formatCurrency(totalRevenue, { compact: true })} icon={DollarSign} accent="purple" hint="Estimated subscription revenue" />
        <KpiCard label="Platform Activity" value={formatNumber(totalOrders)} icon={Activity} accent="amber" hint={`${totalProducts} products in catalog`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Tenant Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Orders & users per tenant</p>
          </div>
          <div className="p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenantsByData.map(t => ({
                name: t.name.length > 14 ? t.name.slice(0, 12) + '…' : t.name,
                orders: getCount(t, 'salesOrders'),
                users: getCount(t, 'users'),
                products: getCount(t, 'products'),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="users" name="Users" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Plan Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tenant subscription tiers</p>
          </div>
          <div className="p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={(e: any) => `${e.name}: ${e.value}`}
                  labelLine={false}
                >
                  {planDistribution.map((p) => (
                    <Cell key={p.plan} fill={PLAN_COLORS[p.plan]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tenants table */}
      <SectionCard
        title="All Tenants"
        subtitle={`${tenants.length} corporations on the platform`}
        action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Tenant</Button>}
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Tenant</th>
                <th className="pb-2 pr-4 font-medium">Industry</th>
                <th className="pb-2 pr-4 font-medium">Plan</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Users</th>
                <th className="pb-2 pr-4 font-medium text-right">Products</th>
                <th className="pb-2 pr-4 font-medium text-right">Orders</th>
                <th className="pb-2 pr-4 font-medium text-right">MRR</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                          {t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.industry}</td>
                  <td className="py-3 pr-4">
                    <Badge className="capitalize" style={{
                      backgroundColor: PLAN_COLORS[t.plan] + '20',
                      color: PLAN_COLORS[t.plan],
                      borderColor: PLAN_COLORS[t.plan] + '40',
                    }}>
                      {PLAN_LABELS[t.plan]}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3 pr-4 text-right tabular-nums">{getCount(t, 'users')}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{getCount(t, 'products')}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{getCount(t, 'salesOrders')}</td>
                  <td className="py-3 pr-4 text-right tabular-nums font-medium">
                    {formatCurrency((PLAN_PRICES[t.plan] || 0) * getCount(t, 'users'))}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(t.createdAt, { month: 'short', year: 'numeric' })}</td>
                  <td className="py-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => impersonateTenant(t)}>
                          <Users className="h-3.5 w-3.5 mr-2" /> Login as Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditTenant(t)}>
                          <Edit className="h-3.5 w-3.5 mr-2" /> Edit Tenant
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadTenantBackup(t.id)}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Download Backup
                        </DropdownMenuItem>
                        {t.status === 'active' ? (
                          <DropdownMenuItem onClick={() => setSuspendTenant(t)}>
                            <Ban className="h-3.5 w-3.5 mr-2" /> Suspend Tenant
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => patchTenant(t.id, { status: 'active' })}>
                            <CheckCircle className="h-3.5 w-3.5 mr-2" /> Unsuspend Tenant
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600" onClick={() => setDeleteTenant(t)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Permission matrix */}
      <SectionCard title="Role & Permission Matrix" subtitle="Built-in role hierarchy across the platform">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Module</th>
                <th className="pb-2 pr-4 font-medium text-center">Owner</th>
                <th className="pb-2 pr-4 font-medium text-center">Tenant Admin</th>
                <th className="pb-2 pr-4 font-medium text-center">Manager</th>
                <th className="pb-2 pr-4 font-medium text-center">Employee</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Owner Console', 'Full', '—', '—', '—'],
                ['Dashboard', 'Cross-tenant', 'Full', 'Dept-filtered', 'Personal'],
                ['Inventory', 'View all', 'Full', 'Full', 'View only'],
                ['Sales Orders', 'View all', 'Full', 'Approve', 'Create/Edit'],
                ['Customers (CRM)', 'View all', 'Full', 'Full', 'View only'],
                ['Purchasing', 'View all', 'Full', 'Approve', 'View only'],
                ['HR', 'View all', 'Full', 'View dept', '—'],
                ['Finance', 'View all', 'Full', 'View', '—'],
                ['Reports', 'All tenants', 'Full', 'Full', 'Limited'],
                ['User Management', '—', 'Full', 'View own', '—'],
                ['Tenant Settings', '—', 'Full', 'View', '—'],
              ].map(([mod, owner, admin, mgr, emp], i) => (
                <tr key={i} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4 font-medium">{mod}</td>
                  <td className="py-3 pr-4 text-center"><PermBadge value={owner} /></td>
                  <td className="py-3 pr-4 text-center"><PermBadge value={admin} /></td>
                  <td className="py-3 pr-4 text-center"><PermBadge value={mgr} /></td>
                  <td className="py-3 pr-4 text-center"><PermBadge value={emp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Owner full-DB backup card */}
      <SectionCard title="Platform-Wide Backup" subtitle="Download ALL tenant data as a single JSON file (OWNER only)">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Includes all tenants, users, products, customers, orders, POs, transactions, employees, and audit logs.
              Excludes user password hashes for security.
            </p>
          </div>
          <Button onClick={() => window.open('/api/erp/backup', '_blank')}>
            <Download className="h-4 w-4 mr-2" /> Download Full Backup
          </Button>
        </div>
      </SectionCard>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">{success}</AlertDescription>
        </Alert>
      )}

      <TenantForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />
      <EditTenantForm open={!!editTenant} onClose={() => setEditTenant(null)} onSaved={loadData} tenant={editTenant} />
      <SuspendTenantDialog
        open={!!suspendTenant}
        onClose={() => setSuspendTenant(null)}
        tenant={suspendTenant}
        onConfirm={async (reason) => { await patchTenant(suspendTenant.id, { status: 'suspended', reason }); setSuspendTenant(null) }}
      />
      <DeleteTenantDialog
        open={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        tenant={deleteTenant}
        onConfirm={async () => { await deleteTenantById(deleteTenant.id); setDeleteTenant(null) }}
      />

      {/* Platform Settings — deflation fee */}
      <PlatformSettingsCard />
    </div>
  )
}

/** Platform-wide settings card — deflation fee for cross-tenant redemptions. */
function PlatformSettingsCard() {
  const [settings, setSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feeEnabled, setFeeEnabled] = useState(true)
  const [feePercent, setFeePercent] = useState('10')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/platform/settings')
      .then(r => r.json())
      .then(d => {
        const s = d.settings || []
        setSettings(s)
        const fe = s.find((x: any) => x.key === 'crossTenantFeeEnabled')
        const fp = s.find((x: any) => x.key === 'crossTenantFeePercent')
        setFeeEnabled(fe?.value !== 'false')
        setFeePercent(fp?.value || '10')
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setSuccess('')
    await Promise.all([
      fetch('/api/platform/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'crossTenantFeeEnabled', value: String(feeEnabled) }) }),
      fetch('/api/platform/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'crossTenantFeePercent', value: feePercent }) }),
    ])
    setSuccess('Saved')
    setSaving(false)
    setTimeout(() => setSuccess(''), 2000)
  }

  if (loading) return null

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg bg-purple-50 p-2"><Globe className="h-4 w-4 text-purple-600" /></div>
        <div>
          <h4 className="font-semibold text-sm">Platform Settings — Deflation Fee</h4>
          <p className="text-xs text-muted-foreground">Controls point inflation in the cross-tenant circular economy</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
        Points flow in a circle: platform → tenants → employees → shops → employees → ...
        Without a burn mechanism, points accumulate indefinitely (inflation). The fee removes
        a percentage of points from circulation on every cross-tenant redemption, keeping the
        total supply bounded.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={feeEnabled} onChange={e => setFeeEnabled(e.target.checked)} className="accent-primary h-4 w-4" />
          <span className="font-medium">Enable deflation fee</span>
        </label>
        <div className="space-y-1">
          <label className="text-xs font-medium">Fee percentage (%)</label>
          <input type="number" min="0" max="100" value={feePercent} onChange={e => setFeePercent(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={!feeEnabled} />
          <p className="text-[10px] text-muted-foreground">0% = no fee, 10% = shop owner receives 90% of points, 100% = full burn</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>Save Settings</Button>
        {success && <span className="text-sm text-emerald-600">{success}</span>}
      </div>
    </Card>
  )
}

function PermBadge({ value }: { value: string }) {
  if (value === '—') return <span className="text-muted-foreground/40">—</span>
  const colors: Record<string, string> = {
    'Full': 'bg-emerald-100 text-emerald-700',
    'View all': 'bg-indigo-100 text-indigo-700',
    'Cross-tenant': 'bg-amber-100 text-amber-700',
    'All tenants': 'bg-amber-100 text-amber-700',
    'Approve': 'bg-purple-100 text-purple-700',
    'Create/Edit': 'bg-blue-100 text-blue-700',
    'View only': 'bg-slate-100 text-slate-600',
    'View': 'bg-slate-100 text-slate-600',
    'View dept': 'bg-slate-100 text-slate-600',
    'Personal': 'bg-slate-100 text-slate-600',
    'Limited': 'bg-slate-100 text-slate-600',
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[value] || 'bg-slate-100 text-slate-600'}`}>{value}</span>
}
