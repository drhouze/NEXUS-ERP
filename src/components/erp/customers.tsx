'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge, LifecycleBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users, UserCheck, DollarSign, TrendingUp, Search, Mail, Phone, Building2, Plus,
  Pencil, Cake, Mars, IdCard, Flag, Briefcase, Tag,
} from 'lucide-react'
import { CustomerForm } from './forms'
import { EditDialog, EditField } from './edit-dialog'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

interface CustomersData {
  customers: any[]
  statusCounts: { status: string; _count: number }[]
  lifecycleCounts?: Record<string, number>
  summary: {
    total: number; active: number; leads: number; inactive: number;
    totalSpent: number; avgSpent: number;
  }
}

const LIFECYCLE_STAGES = ['lead', 'mql', 'sql', 'opportunity', 'customer', 'churned']

export function CustomersModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<CustomersData | null>(null)
  const [search, setSearch] = useState('')
  const [lifecycleFilter, setLifecycleFilter] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const canAdd = userRole === 'OWNER' || userRole === 'TENANT_ADMIN' || userRole === 'MANAGER'

  const loadData = () => fetch('/api/erp/customers').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.customers.filter(c =>
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())) &&
      (lifecycleFilter === 'all' || (c.lifecycleStage || 'lead') === lifecycleFilter)
    )
  }, [data, search, lifecycleFilter])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  const selectedCustomer = data.customers.find(c => c.id === selected) || filtered[0]

  // ---- EditDialog field config ----
  const editFields: EditField[] = [
    { key: 'name', label: 'Contact Name', type: 'text', required: true, halfWidth: true },
    { key: 'company', label: 'Company', type: 'text', required: true, halfWidth: true },
    { key: 'email', label: 'Email', type: 'email', required: true, halfWidth: true },
    { key: 'phone', label: 'Phone', type: 'phone', halfWidth: true },
    { key: 'idType', label: 'ID Type', type: 'select', options: ['IC', 'Passport', 'Other'], halfWidth: true },
    { key: 'idNumber', label: 'ID Number', type: 'text', halfWidth: true },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', halfWidth: true },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], halfWidth: true },
    { key: 'nationality', label: 'Nationality', type: 'text', halfWidth: true, placeholder: 'Malaysian' },
    { key: 'occupation', label: 'Occupation', type: 'text', halfWidth: true },
    { key: 'lifecycleStage', label: 'Lifecycle Stage', type: 'select', options: LIFECYCLE_STAGES, halfWidth: true },
    { key: 'leadSource', label: 'Lead Source', type: 'text', halfWidth: true, placeholder: 'Referral, Walk-in, etc.' },
    { key: 'status', label: 'Status', type: 'select', options: ['lead', 'active', 'inactive'], halfWidth: true },
    { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'VIP, Repeat buyer' },
  ]

  function tagsToString(t: any): string {
    if (Array.isArray(t)) return t.join(', ')
    if (typeof t === 'string') {
      try {
        const p = JSON.parse(t)
        return Array.isArray(p) ? p.join(', ') : t
      } catch { return t }
    }
    return ''
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Customers" value={formatNumber(data.summary.total)} icon={Users} accent="indigo" />
        <KpiCard label="Active" value={formatNumber(data.summary.active)} icon={UserCheck} accent="emerald" />
        <KpiCard label="Total Spent" value={formatCurrency(data.summary.totalSpent, { compact: true })} icon={DollarSign} accent="purple" />
        <KpiCard label="Avg Lifetime Value" value={formatCurrency(data.summary.avgSpent)} icon={TrendingUp} accent="amber" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Top Customers by Spend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lifetime value leaderboard</p>
        </div>
        <div className="p-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.customers.slice(0, 8).map(c => ({
              name: c.company.length > 14 ? c.company.slice(0, 12) + '…' : c.company,
              spent: c.totalSpent,
            }))} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v: any) => [formatCurrency(v), 'Spent']}
              />
              <Bar dataKey="spent" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer list */}
        <SectionCard
          title="Customers"
          subtitle={`${filtered.length} of ${data.customers.length}`}
          className="lg:col-span-2"
          action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>}
        >
          {/* CRM filters: search + lifecycle dropdown */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={lifecycleFilter}
              onChange={e => setLifecycleFilter(e.target.value)}
            >
              <option value="all">All Lifecycle Stages</option>
              {LIFECYCLE_STAGES.map(s => (
                <option key={s} value={s}>{s.replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((c) => {
              const lifecycle = c.lifecycleStage || 'lead'
              const tags: string[] = Array.isArray(c.tags) ? c.tags : []
              const isMalaysian = (c.nationality || '').toLowerCase() === 'malaysian'
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`text-left rounded-xl border p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 ${selected === c.id ? 'border-indigo-400 bg-indigo-50/50' : 'border-border'}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                        {c.company.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{c.company}</span>
                        <LifecycleBadge stage={lifecycle} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>

                      {/* Chips: age/gender, ID, nationality, tags, lead source */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(c.age != null && c.age !== '') && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Cake className="h-2.5 w-2.5" /> {c.age}y
                          </Badge>
                        )}
                        {c.gender && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Mars className="h-2.5 w-2.5" /> {c.gender}
                          </Badge>
                        )}
                        {c.idNumber && (
                          <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                            <IdCard className="h-2.5 w-2.5" /> {c.idType || 'ID'}: {String(c.idNumber).slice(0, 8)}
                          </Badge>
                        )}
                        {c.nationality && !isMalaysian && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Flag className="h-2.5 w-2.5" /> {c.nationality}
                          </Badge>
                        )}
                        {tags.slice(0, 2).map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                            <Tag className="h-2.5 w-2.5" /> {t}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {c.orders.length} orders
                          {c.leadSource && <> · via {c.leadSource}</>}
                        </span>
                        <span className="font-semibold text-sm tabular-nums">{formatCurrency(c.totalSpent, { compact: true })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* Customer detail */}
        <SectionCard
          title="Customer Details"
          subtitle="Profile & recent orders"
          action={selectedCustomer && canAdd && (
            <Button size="sm" variant="outline" onClick={() => setEditing(selectedCustomer)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        >
          {selectedCustomer ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                    {selectedCustomer.company.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h4 className="font-semibold truncate">{selectedCustomer.company}</h4>
                  <p className="text-sm text-muted-foreground truncate">{selectedCustomer.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge status={selectedCustomer.status} />
                    <LifecycleBadge stage={selectedCustomer.lifecycleStage || 'lead'} />
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{selectedCustomer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              </div>

              {/* Personal Info section */}
              {(selectedCustomer.dateOfBirth || selectedCustomer.age != null || selectedCustomer.gender || selectedCustomer.idNumber || selectedCustomer.nationality || selectedCustomer.occupation) && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Personal Info</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {selectedCustomer.age != null && selectedCustomer.age !== '' && (
                      <div className="flex items-center gap-1.5">
                        <Cake className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedCustomer.age} years old</span>
                      </div>
                    )}
                    {selectedCustomer.dateOfBirth && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">DOB:</span>
                        <span>{formatDate(selectedCustomer.dateOfBirth)}</span>
                      </div>
                    )}
                    {selectedCustomer.gender && (
                      <div className="flex items-center gap-1.5">
                        <Mars className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedCustomer.gender}</span>
                      </div>
                    )}
                    {selectedCustomer.idNumber && (
                      <div className="flex items-center gap-1.5">
                        <IdCard className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedCustomer.idType || 'ID'}: {selectedCustomer.idNumber}</span>
                      </div>
                    )}
                    {selectedCustomer.nationality && (
                      <div className="flex items-center gap-1.5">
                        <Flag className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedCustomer.nationality}</span>
                      </div>
                    )}
                    {selectedCustomer.occupation && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedCustomer.occupation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags section */}
              {Array.isArray(selectedCustomer.tags) && selectedCustomer.tags.length > 0 && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedCustomer.tags.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        <Tag className="h-2.5 w-2.5" /> {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead source */}
              {selectedCustomer.leadSource && (
                <div className="pt-3 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground">Lead Source:</span>{' '}
                  <span className="font-medium">{selectedCustomer.leadSource}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total Spent</p>
                  <p className="font-bold text-lg tabular-nums">{formatCurrency(selectedCustomer.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Orders</p>
                  <p className="font-bold text-lg tabular-nums">{selectedCustomer.orders.length}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Recent Orders</p>
                <div className="space-y-2">
                  {selectedCustomer.orders.slice(0, 5).map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-xs">{o.orderNumber}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(o.createdAt, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        <span className="font-medium tabular-nums">{formatCurrency(o.total)}</span>
                      </div>
                    </div>
                  ))}
                  {selectedCustomer.orders.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Select a customer to view details
            </div>
          )}
        </SectionCard>
      </div>

      {canAdd && <CustomerForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />}

      {/* EditDialog with all CRM fields */}
      <EditDialog
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        title={`Edit ${editing?.company || ''}`}
        description="Update CRM, contact, and personal info fields"
        fields={editFields}
        initialData={editing ? {
          name: editing.name,
          company: editing.company,
          email: editing.email,
          phone: editing.phone,
          idType: editing.idType || '',
          idNumber: editing.idNumber || '',
          dateOfBirth: editing.dateOfBirth || '',
          gender: editing.gender || '',
          nationality: editing.nationality || '',
          occupation: editing.occupation || '',
          lifecycleStage: editing.lifecycleStage || 'lead',
          leadSource: editing.leadSource || '',
          status: editing.status || 'lead',
          tags: tagsToString(editing.tags),
        } : {}}
        size="lg"
        module="customer"
        entityType="customer"
        entityId={editing?.id}
        showNotes
        showAttachments
        submitLabel="Save Changes"
        onSubmit={async (formData) => {
          if (!editing) return
          const body: any = { ...formData }
          // Convert comma-separated tags back to an array
          if (typeof body.tags === 'string') {
            body.tags = body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          }
          const res = await fetch(`/api/erp/customers/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || 'Failed to update customer')
          }
          loadData()
        }}
      />
    </div>
  )
}
