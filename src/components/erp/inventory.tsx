'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate, relativeTime } from './lib'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Package, DollarSign, AlertTriangle, Boxes, Search, Warehouse as WarehouseIcon, Plus,
  ArrowRightLeft, TrendingUp, TrendingDown, ScanLine, Layers, ClipboardCheck, BarCode,
  Loader2, AlertCircle, CheckCircle2, ChevronRight, Clock, Pencil,
} from 'lucide-react'
import { ProductForm } from './forms'
import { EditDialog, EditField } from './edit-dialog'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Pie, PieChart, Cell, Legend,
} from 'recharts'

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#3b82f6', '#ef4444']

// Product categories / pack units — shared with forms.tsx (kept in sync manually
// since these are used for the EditDialog dropdowns).
const PRODUCT_CATEGORIES = ['Electronics', 'Furniture', 'Office Supplies', 'Software', 'Medication', 'Food & Beverage', 'Apparel', 'Other', '']
const PACK_UNITS = ['pack', 'box', 'bottle', 'strip', 'carton', 'bag', 'sachet', 'tube', 'roll', 'set', '']
const BASE_UNITS = ['unit', 'tablet', 'capsule', 'ml', 'g', 'kg', 'piece', 'sheet', 'serving', 'hour', '']

export function InventoryModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const canAdd = userRole === 'OWNER' || userRole === 'TENANT_ADMIN' || userRole === 'MANAGER'

  return (
    <Tabs defaultValue="products">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        <TabsTrigger value="movements">Stock Movements</TabsTrigger>
        <TabsTrigger value="forecast">Forecasting</TabsTrigger>
        <TabsTrigger value="serials">Serials</TabsTrigger>
        <TabsTrigger value="batches">Batches</TabsTrigger>
        <TabsTrigger value="stocktake">Stock Take</TabsTrigger>
        <TabsTrigger value="boms">Kits / BOMs</TabsTrigger>
      </TabsList>

      <TabsContent value="products"><ProductsTab userRole={userRole} canAdd={canAdd} /></TabsContent>
      <TabsContent value="warehouses"><WarehousesTab canAdd={canAdd} /></TabsContent>
      <TabsContent value="movements"><MovementsTab /></TabsContent>
      <TabsContent value="forecast"><ForecastTab /></TabsContent>
      <TabsContent value="serials"><SerialsTab canAdd={canAdd} /></TabsContent>
      <TabsContent value="batches"><BatchesTab canAdd={canAdd} /></TabsContent>
      <TabsContent value="stocktake"><StockTakeTab canAdd={canAdd} /></TabsContent>
      <TabsContent value="boms"><BOMsTab canAdd={canAdd} /></TabsContent>
    </Tabs>
  )
}

// ============ Products Tab (upgraded with cost/retail valuation) ============
function ProductsTab({ userRole, canAdd }: { userRole: string; canAdd: boolean }) {
  const [data, setData] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const loadData = () => fetch('/api/erp/products').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.products.filter((p: any) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
      (category === 'all' || p.category === category)
    )
  }, [data, search, category])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  // ---- EditDialog field config for products ----
  // Pack-based billing fields (packSize, packUnit, baseUnit) are first-class Product columns.
  // route/dosageForm/strength/packaging are NOT here — they're custom fields handled
  // by the CustomFieldsRenderer embedded inside the EditDialog (module="product").
  const editFields: EditField[] = [
    { key: 'name', label: 'Product Name', type: 'text', required: true, halfWidth: true },
    { key: 'sku', label: 'SKU', type: 'text', required: true, halfWidth: true },
    { key: 'category', label: 'Category', type: 'select', options: PRODUCT_CATEGORIES.filter(Boolean), halfWidth: true },
    { key: 'productType', label: 'Product Type', type: 'select', options: ['standard', 'service'], halfWidth: true },
    { key: 'price', label: 'Price (per pack)', type: 'number', required: true, halfWidth: true },
    { key: 'cost', label: 'Cost (per pack)', type: 'number', required: true, halfWidth: true },
    // Pack fields shown only for non-service products
    { key: 'packSize', label: 'Pack Size', type: 'number', halfWidth: true, showIf: d => d.productType !== 'service' },
    { key: 'packUnit', label: 'Pack Unit', type: 'select', options: PACK_UNITS.filter(Boolean), halfWidth: true, showIf: d => d.productType !== 'service' },
    { key: 'baseUnit', label: 'Base Unit', type: 'select', options: BASE_UNITS.filter(Boolean), halfWidth: true, showIf: d => d.productType !== 'service' },
    { key: 'stockQty', label: 'Stock Qty', type: 'number', halfWidth: true, showIf: d => d.productType !== 'service' },
    { key: 'reorderLevel', label: 'Reorder Level', type: 'number', halfWidth: true, showIf: d => d.productType !== 'service' },
  ]

  return (
    <div className="space-y-6">
      {/* Valuation KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Products" value={formatNumber(data.summary.total)} icon={Package} accent="indigo" />
        <KpiCard label="Cost Value" value={formatCurrency(data.summary.totalCostValue, { compact: true })} icon={DollarSign} accent="blue" hint="At cost price" />
        <KpiCard label="Retail Value" value={formatCurrency(data.summary.totalRetailValue, { compact: true })} icon={DollarSign} accent="emerald" hint="At selling price" />
        <KpiCard label="Potential Margin" value={formatCurrency(data.summary.totalPotentialMargin, { compact: true })} icon={TrendingUp} accent="purple" hint={`${data.summary.marginPct.toFixed(1)}% margin`} />
        <KpiCard label="Low Stock" value={formatNumber(data.summary.lowStock)} icon={AlertTriangle} accent="amber" hint={`${data.summary.outOfStock} out of stock`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Stock Levels by Product</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Current quantity on hand</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.products.slice(0, 12).map((p: any) => ({ name: p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name, qty: p.stockQty, reorder: p.reorderLevel }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="qty" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">By Category</h3>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.categories.map((c: any) => ({ name: c.category, value: c._count }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {data.categories.map((_: any, i: number) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Product table with cost + retail + margin */}
      <SectionCard
        title="Product Catalog"
        subtitle={`${filtered.length} of ${data.products.length} products`}
        action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {data.categories.map((c: any) => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">SKU</th>
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium">Warehouse</th>
                <th className="pb-2 pr-4 font-medium">Stock</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                <th className="pb-2 pr-4 font-medium text-right">Price</th>
                <th className="pb-2 pr-4 font-medium text-right">Margin</th>
                <th className="pb-2 pr-4 font-medium text-right">Stock Value</th>
                {canAdd && <th className="pb-2 pr-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const ratio = p.reorderLevel > 0 ? Math.min(100, (p.stockQty / (p.reorderLevel * 3)) * 100) : 0
                const isLow = p.stockQty <= p.reorderLevel
                const isOut = p.stockQty === 0
                return (
                  <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.category}</td>
                    <td className="py-3 pr-4"><Badge variant="outline" className="text-xs">{p.warehouseCode}</Badge></td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <span className="font-medium tabular-nums w-8">{p.stockQty}</span>
                        <Progress value={ratio} className="h-1.5 w-16" />
                      </div>
                    </td>
                    <td className="py-3 pr-4">{isOut ? <StatusBadge status="cancelled" /> : isLow ? <StatusBadge status="pending" /> : <StatusBadge status="active" />}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{formatCurrency(p.cost)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatCurrency(p.price)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      <span className={p.marginPct > 50 ? 'text-emerald-600 font-medium' : p.marginPct > 20 ? 'text-amber-600' : 'text-rose-600'}>
                        {p.marginPct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatCurrency(p.retailValue, { compact: true })}</td>
                    {canAdd && (
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit product"
                            onClick={() => setEditing(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isLow && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                              if (!p.supplierId) { alert('No supplier assigned'); return }
                              if (!confirm(`Reorder ${p.name}?`)) return
                              const res = await fetch(`/api/erp/products/${p.id}/reorder`, { method: 'POST' })
                              if (res.ok) loadData()
                            }}>
                              Reorder
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td colSpan={6} className="py-3 pr-4">Total ({filtered.length} products)</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(filtered.reduce((s: number, p: any) => s + p.cost, 0), { compact: true })}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(filtered.reduce((s: number, p: any) => s + p.price, 0), { compact: true })}</td>
                <td colSpan={2} className="py-3 pr-4 text-right tabular-nums">{formatCurrency(filtered.reduce((s: number, p: any) => s + p.retailValue, 0), { compact: true })}</td>
              </tr>
            </tfoot>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No products match your filters</div>}
        </div>
      </SectionCard>

      {canAdd && <ProductForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />}

      {/* Edit product dialog — pack fields + custom fields (route/dosageForm/etc.) */}
      <EditDialog
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        title={`Edit ${editing?.name || ''}`}
        description="Update product details, pack config, and custom attributes. Route, dosage form, strength and packaging live in the Custom Fields section below."
        fields={editFields}
        initialData={editing ? {
          name: editing.name,
          sku: editing.sku,
          category: editing.category,
          productType: editing.productType || 'standard',
          price: String(editing.price ?? ''),
          cost: String(editing.cost ?? ''),
          packSize: String(editing.packSize ?? 1),
          packUnit: editing.packUnit || 'pack',
          baseUnit: editing.baseUnit || 'unit',
          stockQty: String(editing.stockQty ?? 0),
          reorderLevel: String(editing.reorderLevel ?? 0),
        } : {}}
        size="lg"
        module="product"
        entityType="product"
        entityId={editing?.id}
        showNotes
        showAttachments
        submitLabel="Save Changes"
        onSubmit={async (formData) => {
          if (!editing) return
          const body: any = {}
          for (const k of ['name', 'sku', 'category', 'productType', 'price', 'cost', 'packSize', 'packUnit', 'baseUnit', 'stockQty', 'reorderLevel']) {
            if (formData[k] !== undefined && formData[k] !== '') body[k] = formData[k]
          }
          const res = await fetch(`/api/erp/products/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || 'Failed to update product')
          }
          loadData()
        }}
      />
    </div>
  )
}

// ============ Warehouses Tab ============
function WarehousesTab({ canAdd }: { canAdd: boolean }) {
  const [data, setData] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', address: '' })

  const loadData = () => fetch('/api/erp/inventory/warehouses').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  async function createWarehouse() {
    const res = await fetch('/api/erp/inventory/warehouses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setShowForm(false); setForm({ code: '', name: '', address: '' }); loadData() }
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Warehouses</p><p className="text-2xl font-bold">{data.warehouses.length}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Total Stock Value</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(Object.values(data.warehouseStats).reduce((s: number, w: any) => s + w.stockValue, 0), { compact: true })}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Total Retail Value</p><p className="text-2xl font-bold text-indigo-600">{formatCurrency(Object.values(data.warehouseStats).reduce((s: number, w: any) => s + w.retailValue, 0), { compact: true })}</p></Card>
        </div>
        {canAdd && (
          <div className="flex gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}><ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Stock</Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Warehouse</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.warehouses.map((w: any) => {
          const stats = data.warehouseStats[w.id] || { productCount: 0, stockValue: 0, retailValue: 0 }
          return (
            <Card key={w.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2.5"><WarehouseIcon className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <h4 className="font-semibold">{w.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono">{w.code}</p>
                  </div>
                </div>
                {w.isDefault && <Badge className="bg-indigo-100 text-indigo-700">Default</Badge>}
              </div>
              {w.address && <p className="text-xs text-muted-foreground mb-3">{w.address}</p>}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
                <div><p className="text-xs text-muted-foreground">Products</p><p className="font-semibold">{stats.productCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Cost Value</p><p className="font-semibold text-sm">{formatCurrency(stats.stockValue, { compact: true })}</p></div>
                <div><p className="text-xs text-muted-foreground">Retail</p><p className="font-semibold text-sm text-emerald-600">{formatCurrency(stats.retailValue, { compact: true })}</p></div>
              </div>
            </Card>
          )
        })}
      </div>

      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Warehouse</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WH-EAST" /></div>
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="East Warehouse" /></div>
              <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 East St" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={createWarehouse}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showTransfer && <TransferDialog warehouses={data.warehouses} products={data} onClose={() => setShowTransfer(false)} onDone={loadData} />}
    </div>
  )
}

// ============ Transfer Dialog ============
function TransferDialog({ warehouses, onClose, onDone }: { warehouses: any[]; products: any; onClose: () => void; onDone: () => void }) {
  const [productId, setProductId] = useState('')
  const [fromWh, setFromWh] = useState('')
  const [toWh, setToWh] = useState('')
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [allProducts, setAllProducts] = useState<any[]>([])

  useEffect(() => { fetch('/api/erp/products').then(r => r.json()).then(d => setAllProducts(d.products || [])) }, [])

  async function submit() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/inventory/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, fromWarehouseId: fromWh, toWarehouseId: toWh, quantity: qty }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onDone(); onClose()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Transfer Stock</DialogTitle><DialogDescription>Move stock from one warehouse to another</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Product *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.stockQty} in stock</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">From Warehouse *</Label><Select value={fromWh} onValueChange={setFromWh}><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger><SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">To Warehouse *</Label><Select value={toWh} onValueChange={setToWh}><SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger><SelectContent>{warehouses.filter((w: any) => w.id !== fromWh).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label className="text-xs">Quantity *</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" /></div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={loading || !productId || !fromWh || !toWh || !qty}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Transfer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Stock Movements Tab ============
function MovementsTab() {
  const [movements, setMovements] = useState<any[]>([])
  const [showAdjust, setShowAdjust] = useState(false)

  const loadData = () => fetch('/api/erp/inventory/stock-movements').then(r => r.json()).then(d => setMovements(d.movements || []))
  useEffect(() => { loadData() }, [])

  const TYPE_COLORS: Record<string, string> = {
    in: 'bg-emerald-100 text-emerald-700', out: 'bg-rose-100 text-rose-700',
    adjustment: 'bg-amber-100 text-amber-700', transfer_in: 'bg-blue-100 text-blue-700', transfer_out: 'bg-purple-100 text-purple-700',
  }

  return (
    <SectionCard title="Stock Movements" subtitle={`${movements.length} movements`} action={<Button size="sm" onClick={() => setShowAdjust(true)}><Plus className="h-4 w-4 mr-2" />Adjust Stock</Button>}>
      <div className="overflow-x-auto -mx-5 px-5 max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 font-medium">Product</th>
              <th className="pb-2 pr-4 font-medium">Warehouse</th>
              <th className="pb-2 pr-4 font-medium text-right">Qty</th>
              <th className="pb-2 pr-4 font-medium">Reason</th>
              <th className="pb-2 pr-4 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m: any) => (
              <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-4 text-muted-foreground text-xs">{relativeTime(m.createdAt)}</td>
                <td className="py-2 pr-4"><Badge className={TYPE_COLORS[m.type] || 'bg-slate-100'}>{m.type.replace(/_/g, ' ')}</Badge></td>
                <td className="py-2 pr-4 font-medium">{m.product?.name}</td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{m.warehouse?.name || m.warehouse?.code || '—'}</td>
                <td className={`py-2 pr-4 text-right tabular-nums font-medium ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                <td className="py-2 pr-4 text-muted-foreground">{m.reason}</td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No stock movements yet</div>}
      </div>

      {showAdjust && <AdjustDialog onClose={() => setShowAdjust(false)} onDone={loadData} />}
    </SectionCard>
  )
}

function AdjustDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('in')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('adjustment')
  const [notes, setNotes] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || [])) }, [])

  async function submit() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/inventory/stock-movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, type, quantity: qty, reason, notes }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onDone(); onClose()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust Stock</DialogTitle><DialogDescription>Record a manual stock in/out/adjustment</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Product *</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.stockQty} in stock)</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Type *</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in">Stock In (+)</SelectItem><SelectItem value="out">Stock Out (−)</SelectItem><SelectItem value="adjustment">Adjustment</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Quantity *</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Reason</Label><Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adjustment">Adjustment</SelectItem><SelectItem value="return">Customer Return</SelectItem><SelectItem value="damage">Damaged</SelectItem><SelectItem value="loss">Loss/Shrinkage</SelectItem><SelectItem value="found">Found</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" /></div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={loading || !productId || !qty}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Record</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Forecasting Tab ============
function ForecastTab() {
  const [data, setData] = useState<any>(null)

  useEffect(() => { fetch('/api/erp/inventory/forecast').then(r => r.json()).then(setData) }, [])

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
    reorder_now: { label: 'Reorder Now', color: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
    reorder_soon: { label: 'Reorder Soon', color: 'bg-amber-100 text-amber-700', icon: Clock },
    monitor: { label: 'Monitor', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
    healthy: { label: 'Healthy', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Reorder Now</p><p className="text-2xl font-bold text-rose-600">{data.summary.reorderNow}</p></div><AlertTriangle className="h-5 w-5 text-rose-500" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Reorder Soon</p><p className="text-2xl font-bold text-amber-600">{data.summary.reorderSoon}</p></div><Clock className="h-5 w-5 text-amber-500" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Monitor</p><p className="text-2xl font-bold text-blue-600">{data.summary.monitor}</p></div><TrendingUp className="h-5 w-5 text-blue-500" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Healthy</p><p className="text-2xl font-bold text-emerald-600">{data.summary.healthy}</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div></Card>
      </div>

      <SectionCard title="Demand Forecasting" subtitle="Sales velocity-based reorder suggestions (last 30 days)">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
              <th className="pb-2 pr-4 font-medium">Product</th>
              <th className="pb-2 pr-4 font-medium">Stock</th>
              <th className="pb-2 pr-4 font-medium text-right">Daily Velocity</th>
              <th className="pb-2 pr-4 font-medium text-right">30d Sales</th>
              <th className="pb-2 pr-4 font-medium">Trend</th>
              <th className="pb-2 pr-4 font-medium text-right">Days Until Out</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium text-right">Suggested Qty</th>
            </tr></thead>
            <tbody>
              {data.forecasts.map((f: any) => {
                const meta = STATUS_META[f.status]
                return (
                  <tr key={f.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4"><div className="font-medium">{f.name}</div><div className="text-xs text-muted-foreground font-mono">{f.sku}</div></td>
                    <td className="py-2 pr-4 tabular-nums">{f.stockQty}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{f.dailyVelocity}/day</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{f.unitsSold30}</td>
                    <td className="py-2 pr-4">{f.trend === 'up' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : f.trend === 'down' ? <TrendingDown className="h-4 w-4 text-rose-500" /> : <span className="text-muted-foreground text-xs">stable</span>}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{f.daysUntilOut === null ? '∞' : f.daysUntilOut}</td>
                    <td className="py-2 pr-4"><Badge className={meta.color}>{meta.label}</Badge></td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{f.suggestedOrderQty > 0 ? `${f.suggestedOrderQty} units` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ Serials Tab ============
function SerialsTab({ canAdd }: { canAdd: boolean }) {
  const [serials, setSerials] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  const loadData = () => fetch('/api/erp/inventory/serials').then(r => r.json()).then(d => setSerials(d.serials || []))
  useEffect(() => { loadData() }, [])

  return (
    <SectionCard title="Serial Numbers" subtitle={`${serials.length} serials tracked`} action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Serials</Button>}>
      <div className="overflow-x-auto -mx-5 px-5 max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">Serial #</th>
            <th className="pb-2 pr-4 font-medium">Product</th>
            <th className="pb-2 pr-4 font-medium">Warehouse</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Added</th>
          </tr></thead>
          <tbody>
            {serials.map((s: any) => (
              <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-4 font-mono text-xs">{s.serialNumber}</td>
                <td className="py-2 pr-4 font-medium">{s.product?.name}</td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{s.warehouse?.name || '—'}</td>
                <td className="py-2 pr-4"><Badge className={s.status === 'in_stock' ? 'bg-emerald-100 text-emerald-700' : s.status === 'sold' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}>{s.status.replace(/_/g, ' ')}</Badge></td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{relativeTime(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {serials.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No serial numbers tracked yet</div>}
      </div>
      {showForm && <SerialFormDialog onClose={() => setShowForm(false)} onDone={loadData} />}
    </SectionCard>
  )
}

function SerialFormDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [productId, setProductId] = useState('')
  const [serialText, setSerialText] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || [])) }, [])

  async function submit() {
    setLoading(true)
    const serials = serialText.split('\n').map(s => s.trim()).filter(Boolean)
    const res = await fetch('/api/erp/inventory/serials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, serialNumbers: serials }) })
    if (res.ok) { onDone(); onClose() }
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" />Add Serial Numbers</DialogTitle><DialogDescription>Enter one serial per line</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Product *</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Serial Numbers (one per line) *</Label><textarea value={serialText} onChange={e => setSerialText(e.target.value)} className="w-full min-h-[150px] p-2 rounded border border-border font-mono text-sm" placeholder="SN-001&#10;SN-002&#10;SN-003" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={loading || !productId || !serialText}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Batches Tab ============
function BatchesTab({ canAdd }: { canAdd: boolean }) {
  const [batches, setBatches] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  const loadData = () => fetch('/api/erp/inventory/batches').then(r => r.json()).then(d => setBatches(d.batches || []))
  useEffect(() => { loadData() }, [])

  return (
    <SectionCard title="Batch / Lot Tracking" subtitle={`${batches.length} batches`} action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Batch</Button>}>
      <div className="overflow-x-auto -mx-5 px-5 max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">Batch #</th>
            <th className="pb-2 pr-4 font-medium">Product</th>
            <th className="pb-2 pr-4 font-medium text-right">Qty</th>
            <th className="pb-2 pr-4 font-medium">Mfg Date</th>
            <th className="pb-2 pr-4 font-medium">Expiry</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {batches.map((b: any) => (
              <tr key={b.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-4 font-mono text-xs">{b.batchNumber}</td>
                <td className="py-2 pr-4 font-medium">{b.product?.name}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{b.quantity}</td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{b.manufactureDate ? formatDate(b.manufactureDate) : '—'}</td>
                <td className="py-2 pr-4 text-xs">{b.expiryDate ? formatDate(b.expiryDate) : '—'}{b.daysToExpiry !== null && b.daysToExpiry <= 30 && <Badge className="ml-2 bg-amber-100 text-amber-700 text-[10px]">{b.daysToExpiry}d left</Badge>}</td>
                <td className="py-2 pr-4"><Badge className={b.isExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}>{b.isExpired ? 'expired' : b.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {batches.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No batches tracked yet</div>}
      </div>
      {showForm && <BatchFormDialog onClose={() => setShowForm(false)} onDone={loadData} />}
    </SectionCard>
  )
}

function BatchFormDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ productId: '', batchNumber: '', quantity: '', manufactureDate: '', expiryDate: '' })
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || [])) }, [])

  async function submit() {
    setLoading(true)
    const res = await fetch('/api/erp/inventory/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { onDone(); onClose() }
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Add Batch / Lot</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Product *</Label><Select value={form.productId} onValueChange={v => setForm({ ...form, productId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Batch # *</Label><Input value={form.batchNumber} onChange={e => setForm({ ...form, batchNumber: e.target.value })} placeholder="LOT-2026-001" /></div>
            <div><Label className="text-xs">Quantity *</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><Label className="text-xs">Mfg Date</Label><Input type="date" value={form.manufactureDate} onChange={e => setForm({ ...form, manufactureDate: e.target.value })} /></div>
            <div><Label className="text-xs">Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={loading || !form.productId || !form.batchNumber || !form.quantity}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Stock Take Tab ============
function StockTakeTab({ canAdd }: { canAdd: boolean }) {
  const [stockTakes, setStockTakes] = useState<any[]>([])

  const loadData = () => fetch('/api/erp/inventory/stock-takes').then(r => r.json()).then(d => setStockTakes(d.stockTakes || []))
  useEffect(() => { loadData() }, [])

  async function createStockTake() {
    if (!confirm('Start a new stock take? This will snapshot current stock levels for all products.')) return
    const res = await fetch('/api/erp/inventory/stock-takes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (res.ok) loadData()
  }

  return (
    <SectionCard title="Stock Take / Audit" subtitle={`${stockTakes.length} stock takes`} action={canAdd && <Button size="sm" onClick={createStockTake}><Plus className="h-4 w-4 mr-2" />New Stock Take</Button>}>
      <div className="space-y-3">
        {stockTakes.map((st: any) => (
          <Card key={st.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Stock Take {st.id.slice(-6)}</span>
                  <Badge className={st.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : st.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}>{st.status.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {st.warehouse?.name || 'All warehouses'} · {st._count?.items || 0} items · Started {relativeTime(st.createdAt)}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {stockTakes.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No stock takes yet. Click "New Stock Take" to start.</div>}
      </div>
    </SectionCard>
  )
}

// ============ BOMs Tab ============
function BOMsTab({ canAdd }: { canAdd: boolean }) {
  const [boms, setBoms] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  const loadData = () => fetch('/api/erp/inventory/boms').then(r => r.json()).then(d => setBoms(d.boms || []))
  useEffect(() => { loadData() }, [])

  return (
    <SectionCard title="Kits / Bill of Materials" subtitle={`${boms.length} BOMs`} action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add BOM</Button>}>
      <div className="space-y-3">
        {boms.map((bom: any) => (
          <Card key={bom.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{bom.product?.name}</span>
                <Badge variant="outline">{bom.components.length} components</Badge>
              </div>
            </div>
            <div className="space-y-1 ml-6">
              {bom.components.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.component?.name}</span>
                  <span className="tabular-nums font-medium">×{c.quantity}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {boms.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No BOMs yet. Create a kit product (e.g. "Office Starter Pack") and add its component products.</div>}
      </div>
      {showForm && <BOMFormDialog onClose={() => setShowForm(false)} onDone={loadData} />}
    </SectionCard>
  )
}

function BOMFormDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [productId, setProductId] = useState('')
  const [components, setComponents] = useState<{ componentProductId: string; quantity: string }[]>([{ componentProductId: '', quantity: '1' }])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || [])) }, [])

  async function submit() {
    setLoading(true)
    const res = await fetch('/api/erp/inventory/boms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, components: components.filter(c => c.componentProductId) }) })
    if (res.ok) { onDone(); onClose() }
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Create Bill of Materials</DialogTitle><DialogDescription>Define which components make up a kit product</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Kit Product *</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Select kit product" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent></Select></div>
          <div>
            <div className="flex items-center justify-between mb-2"><Label className="text-xs">Components</Label><Button size="sm" variant="outline" onClick={() => setComponents([...components, { componentProductId: '', quantity: '1' }])}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
            {components.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-8"><Select value={c.componentProductId} onValueChange={v => setComponents(components.map((x, idx) => idx === i ? { ...x, componentProductId: v } : x))}><SelectTrigger><SelectValue placeholder="Component" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-3"><Input type="number" value={c.quantity} onChange={e => setComponents(components.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" /></div>
                <div className="col-span-1">{components.length > 1 && <Button size="sm" variant="ghost" className="text-rose-500 h-8 w-8 p-0" onClick={() => setComponents(components.filter((_, idx) => idx !== i))}>×</Button>}</div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={loading || !productId}>Create BOM</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
