'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Building2, Truck, DollarSign, Star, Search, Package, Mail, Phone, Globe, Plus } from 'lucide-react'
import { SupplierForm, PurchaseOrderForm } from './forms'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Pie, PieChart, Cell, Legend
} from 'recharts'

interface PurchasingData {
  suppliers: any[]
  purchaseOrders: any[]
  summary: {
    totalSuppliers: number; totalPOs: number;
    draftPOs: number; sentPOs: number; receivedPOs: number;
    totalSpend: number; avgRating: number;
  }
}

const PO_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', sent: '#3b82f6', received: '#10b981', cancelled: '#ef4444',
}

export function PurchasingModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<PurchasingData | null>(null)
  const [search, setSearch] = useState('')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showPOForm, setShowPOForm] = useState(false)

  const canAdd = userRole === 'OWNER' || userRole === 'TENANT_ADMIN' || userRole === 'MANAGER'

  const loadData = () => fetch('/api/erp/suppliers').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  const filteredSuppliers = useMemo(() => {
    if (!data) return []
    return data.suppliers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contactName.toLowerCase().includes(search.toLowerCase()) ||
      s.country.toLowerCase().includes(search.toLowerCase())
    )
  }, [data, search])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  const poStatusData = ['draft', 'sent', 'received'].map(s => ({
    name: s,
    value: data.purchaseOrders.filter(p => p.status === s).length,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Suppliers" value={formatNumber(data.summary.totalSuppliers)} icon={Building2} accent="indigo" />
        <KpiCard label="Purchase Orders" value={formatNumber(data.summary.totalPOs)} icon={Truck} accent="blue" hint={`${data.summary.draftPOs + data.summary.sentPOs} open`} />
        <KpiCard label="Total Spend" value={formatCurrency(data.summary.totalSpend, { compact: true })} icon={DollarSign} accent="emerald" hint="Received POs" />
        <KpiCard label="Avg Supplier Rating" value={`${data.summary.avgRating.toFixed(1)} ★`} icon={Star} accent="amber" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Purchase Order Spend by Supplier</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Total received PO spend</p>
        </div>
        <div className="p-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.suppliers.map(s => ({
              name: s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name,
              spend: s.purchaseOrders.filter((p: any) => p.status === 'received').reduce((sum: number, p: any) => sum + p.total, 0),
            }))} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Spend']} />
              <Bar dataKey="spend" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Tabs defaultValue="suppliers">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="suppliers">Suppliers ({data.suppliers.length})</TabsTrigger>
            <TabsTrigger value="pos">Purchase Orders ({data.purchaseOrders.length})</TabsTrigger>
          </TabsList>
          {canAdd && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowSupplierForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Supplier</Button>
              <Button size="sm" onClick={() => setShowPOForm(true)}><Plus className="h-4 w-4 mr-2" /> New PO</Button>
            </div>
          )}
        </div>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-md"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((s) => (
              <Card key={s.id} className="p-5 gap-0 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                        {s.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-sm">{s.name}</h4>
                      <p className="text-xs text-muted-foreground">{s.contactName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium">{s.rating}</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{s.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{s.country}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60">
                  <div>
                    <p className="text-xs text-muted-foreground">Products</p>
                    <p className="font-semibold">{s.products.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">POs</p>
                    <p className="font-semibold">{s.purchaseOrders.length}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pos">
          <SectionCard title="Purchase Orders" subtitle={`${data.purchaseOrders.length} total`}>
            <div className="overflow-x-auto -mx-5 px-5 max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="pb-2 pr-4 font-medium">PO #</th>
                    <th className="pb-2 pr-4 font-medium">Supplier</th>
                    <th className="pb-2 pr-4 font-medium">Items</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    {canAdd && <th className="pb-2 pr-4 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.purchaseOrders.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs">{p.poNumber}</td>
                      <td className="py-3 pr-4 font-medium">{p.supplier.name}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {p.items.length} item{p.items.length > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 pr-4 font-medium tabular-nums">{formatCurrency(p.total)}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(p.createdAt)}</td>
                      {canAdd && (
                        <td className="py-3 pr-4 text-right">
                          {(p.status === 'sent' || p.status === 'draft') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={async () => {
                                if (p.status === 'draft') {
                                  if (!confirm(`Send PO ${p.poNumber} to ${p.supplier.name} first?`)) return
                                  await fetch(`/api/erp/purchase-orders/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) })
                                  loadData()
                                  return
                                }
                                if (!confirm(`Receive PO ${p.poNumber}? This will increment stock for ${p.items.length} product(s) and create an expense transaction.`)) return
                                const res = await fetch(`/api/erp/purchase-orders/${p.id}/receive`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                                if (res.ok) loadData()
                              }}
                            >
                              <Package className="h-3 w-3 mr-1" /> {p.status === 'draft' ? 'Send' : 'Receive'}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {canAdd && (
        <>
          <SupplierForm open={showSupplierForm} onClose={() => setShowSupplierForm(false)} onCreated={loadData} />
          <PurchaseOrderForm open={showPOForm} onClose={() => setShowPOForm(false)} onCreated={loadData} />
        </>
      )}
    </div>
  )
}
