'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, AlertCircle, Pill } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SearchableSelect } from './searchable-select'
import { CustomFieldsRenderer, saveCustomFieldValues } from './custom-fields-renderer'
import { getBaseCurrencySymbol } from './lib'

// ============ Shared helpers ============
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ErrorAlert({ error }: { error: string }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

const PRODUCT_CATEGORIES = ['Electronics', 'Furniture', 'Office Supplies', 'Software', 'Medication', 'Food & Beverage', 'Apparel', 'Other']
const PACK_UNITS = ['pack', 'box', 'bottle', 'strip', 'carton', 'bag', 'sachet', 'tube', 'roll', 'set']
const BASE_UNITS = ['unit', 'tablet', 'capsule', 'ml', 'g', 'kg', 'piece', 'sheet', 'serving', 'hour']

// ============ Product Form ============
export function ProductForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [nextSku, setNextSku] = useState('')
  const [saveAndNew, setSaveAndNew] = useState(false)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '', sku: '', category: 'Electronics', price: '', cost: '',
    stockQty: '0', reorderLevel: '10', warehouse: 'WH-Central', supplierId: '',
    packSize: '1', packUnit: 'pack', baseUnit: 'unit', productType: 'standard',
  })

  useEffect(() => {
    if (open) {
      fetch('/api/erp/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || []))
      // Fetch next SKU preview from numbering settings
      fetch('/api/erp/numbering').then(r => r.json()).then(d => {
        if (d.previews?.product) {
          setNextSku(d.previews.product)
          setForm(f => ({ ...f, sku: d.previews.product }))
        }
      })
    }
  }, [open])

  const isService = form.productType === 'service'
  const sym = getBaseCurrencySymbol()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const body: any = { ...form }
      if (isService) {
        // Service items don't track stock — send zeros to be consistent.
        body.stockQty = '0'
        body.reorderLevel = '0'
        body.warehouse = ''
      }
      const res = await fetch('/api/erp/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      // Save custom field values (route, dosageForm, strength, etc.) for the new product.
      const newId = data.product?.id || data.id
      if (newId && Object.keys(customValues).length > 0) {
        await saveCustomFieldValues('product', newId, customValues)
      }
      onCreated()
      if (saveAndNew) {
        setForm({ name: '', sku: '', category: form.category, price: '', cost: '', stockQty: '0', reorderLevel: '10', warehouse: form.warehouse, supplierId: '', packSize: '1', packUnit: form.packUnit, baseUnit: form.baseUnit, productType: form.productType })
        setSaveAndNew(false)
        setCustomValues({})
        fetch('/api/erp/numbering').then(r => r.json()).then(d => {
          if (d.previews?.product) {
            setNextSku(d.previews.product)
            setForm(f => ({ ...f, sku: d.previews.product }))
          }
        })
      } else {
        onClose()
        setForm({ name: '', sku: '', category: 'Electronics', price: '', cost: '', stockQty: '0', reorderLevel: '10', warehouse: 'WH-Central', supplierId: '', packSize: '1', packUnit: 'pack', baseUnit: 'unit', productType: 'standard' })
        setCustomValues({})
      }
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>Create a new inventory item. It will be available in sales orders and purchase orders.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Product type toggle */}
          <div className="flex gap-2">
            {['standard', 'service'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, productType: t })}
                className={`px-3 py-1.5 rounded-lg border text-sm capitalize ${form.productType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
              >
                {t} {t === 'service' && <span className="text-[10px] text-muted-foreground">(no stock)</span>}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Product Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Headphones" autoFocus /></Field>
            <Field label="SKU * (auto-generated)">
              <div className="flex gap-2">
                <Input required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} className="font-mono" />
                {nextSku && (
                  <Button type="button" variant="outline" size="sm" title="Reset to auto-generated" onClick={() => setForm({ ...form, sku: nextSku })}>
                    Auto
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Category *">
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Supplier">
              <Select value={form.supplierId || '__none__'} onValueChange={v => setForm({ ...form, supplierId: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Price (${sym} per pack) *`}><Input required type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></Field>
            <Field label={`Cost (${sym} per pack) *`}><Input required type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></Field>

            {/* Stock fields — only for standard (non-service) products */}
            {!isService && (
              <>
                <Field label="Stock Qty"><Input type="number" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} /></Field>
                <Field label="Reorder Level"><Input type="number" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
                <Field label="Warehouse">
                  <Select value={form.warehouse} onValueChange={v => setForm({ ...form, warehouse: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['WH-North', 'WH-South', 'WH-Central'].map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            {isService && (
              <div className="col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Service items don't track stock. Use these for consultations, labour, hourly billing, etc. Custom fields below can still capture service-specific attributes.
              </div>
            )}
          </div>

          {/* Pack Size card (teal) */}
          <Card className="p-4 bg-teal-50/40 border-teal-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-md bg-teal-100 p-1.5"><Pill className="h-3.5 w-3.5 text-teal-700" /></div>
              <div>
                <h4 className="text-sm font-semibold text-teal-900">Pack Configuration</h4>
                <p className="text-[11px] text-teal-700">For pack-based billing (e.g. 1 pack = 10 tablets)</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Pack Size">
                <Input type="number" min="1" value={form.packSize} onChange={e => setForm({ ...form, packSize: e.target.value })} />
              </Field>
              <Field label="Pack Unit">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.packUnit}
                  onChange={e => setForm({ ...form, packUnit: e.target.value })}
                >
                  {PACK_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Base Unit">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.baseUnit}
                  onChange={e => setForm({ ...form, baseUnit: e.target.value })}
                >
                  {BASE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          {/* Custom fields for product module (route, dosageForm, strength, etc.) */}
          <div className="pt-3 border-t">
            <Label className="text-xs uppercase text-muted-foreground mb-2 block">Custom Fields</Label>
            <CustomFieldsRenderer
              module="product"
              entityType="product"
              values={customValues}
              onValuesChange={setCustomValues}
            />
          </div>

          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="outline" disabled={loading} onClick={() => setSaveAndNew(true)}>
              {loading && saveAndNew ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Save & New
            </Button>
            <Button type="submit" disabled={loading}>{loading && !saveAndNew ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Add Product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Customer Form (CRM upgrade) ============
export function CustomerForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', status: 'lead',
    // Personal info
    dateOfBirth: '', gender: '', idType: '', idNumber: '', nationality: '', occupation: '',
    // CRM lifecycle
    lifecycleStage: 'lead', leadSource: '', ownerId: '', tags: '',
  })

  // liveAge computed from dateOfBirth
  const liveAge = useMemo(() => {
    if (!form.dateOfBirth) return ''
    const d = new Date(form.dateOfBirth)
    if (isNaN(d.getTime())) return ''
    let age = new Date().getFullYear() - d.getFullYear()
    const m = new Date().getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
    return age < 0 ? '' : String(age)
  }, [form.dateOfBirth])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const body: any = { ...form }
      // Tags: comma-separated string → array
      if (typeof body.tags === 'string') {
        body.tags = body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
      // Strip empty optionals so they don't override
      if (!body.dateOfBirth) delete body.dateOfBirth
      if (!body.ownerId) delete body.ownerId
      const res = await fetch('/api/erp/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      // Save custom field values for the new customer (after creation).
      const newId = data.customer?.id || data.id
      if (newId && Object.keys(customValues).length > 0) {
        await saveCustomFieldValues('customer', newId, customValues)
      }
      onCreated(); onClose()
      setForm({
        name: '', email: '', phone: '', company: '', status: 'lead',
        dateOfBirth: '', gender: '', idType: '', idNumber: '', nationality: '', occupation: '',
        lifecycleStage: 'lead', leadSource: '', ownerId: '', tags: '',
      })
      setCustomValues({})
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>Create a new CRM contact. It will appear in the Sales Order customer dropdown.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Section 1: Contact */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
              <Field label="Company *"><Input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="Email *"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* Section 2: Personal Info */}
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Personal Info</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID Type">
                <Select value={form.idType || '__none__'} onValueChange={v => setForm({ ...form, idType: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    <SelectItem value="IC">IC (Malaysian)</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ID Number"><Input value={form.idNumber} onChange={e => setForm({ ...form, idNumber: e.target.value })} placeholder="e.g. 901231-14-5678" /></Field>
              <Field label="Nationality"><Input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} placeholder="Malaysian" /></Field>
              <Field label="Date of Birth"><Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></Field>
              <Field label="Age (auto-calculated)">
                <Input readOnly value={liveAge ? `${liveAge} years` : ''} placeholder="—" className="bg-muted/50" />
              </Field>
              <Field label="Gender">
                <Select value={form.gender || '__none__'} onValueChange={v => setForm({ ...form, gender: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Occupation"><Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} placeholder="e.g. Teacher" /></Field>
            </div>
          </div>

          {/* Section 3: CRM Lifecycle */}
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">CRM Lifecycle</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lifecycle Stage">
                <Select value={form.lifecycleStage} onValueChange={v => setForm({ ...form, lifecycleStage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['lead', 'mql', 'sql', 'opportunity', 'customer', 'churned'].map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Lead Source"><Input value={form.leadSource} onChange={e => setForm({ ...form, leadSource: e.target.value })} placeholder="Referral, Walk-in, Google Ads..." /></Field>
              <Field label="Owner ID (user id)"><Input value={form.ownerId} onChange={e => setForm({ ...form, ownerId: e.target.value })} placeholder="Optional" /></Field>
              <Field label="Tags (comma-separated)"><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="VIP, Repeat buyer" /></Field>
            </div>
          </div>

          {/* Custom fields for customer module */}
          <div className="pt-3 border-t">
            <Label className="text-xs uppercase text-muted-foreground mb-2 block">Custom Fields</Label>
            <CustomFieldsRenderer
              module="customer"
              entityType="customer"
              values={customValues}
              onValuesChange={setCustomValues}
            />
          </div>

          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Customer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Supplier Form ============
export function SupplierForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', country: '', rating: '3' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/suppliers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(); onClose()
      setForm({ name: '', contactName: '', email: '', phone: '', country: '', rating: '3' })
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>Register a new supplier. It will appear in the Purchase Order supplier dropdown and Product form.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Contact Name *"><Input required value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Email *"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Country"><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="e.g. USA" /></Field>
            <Field label="Rating">
              <Select value={form.rating} onValueChange={v => setForm({ ...form, rating: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(r => <SelectItem key={r} value={String(r)}>{r} star{r > 1 ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Supplier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Sales Order Form (with line items) ============
export function SalesOrderForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customerId, setCustomerId] = useState('')
  const [status, setStatus] = useState('pending')
  const [items, setItems] = useState<{ productId: string; qty: string }[]>([{ productId: '', qty: '1' }])
  const [nextOrderNumber, setNextOrderNumber] = useState('')

  useEffect(() => {
    if (open) {
      fetch('/api/erp/customers').then(r => r.json()).then(d => setCustomers(d.customers || []))
      fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || []))
      fetch('/api/erp/numbering').then(r => r.json()).then(d => {
        if (d.previews?.salesOrder) setNextOrderNumber(d.previews.salesOrder)
      })
    }
  }, [open])

  const total = items.reduce((s, it) => {
    const p = products.find(p => p.id === it.productId)
    return s + (p ? p.price * (parseInt(it.qty) || 0) : 0)
  }, 0)

  function addItem() { setItems([...items, { productId: '', qty: '1' }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: 'productId' | 'qty', value: string) {
    setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  const customerOptions = useMemo(
    () => customers.map(c => ({
      value: c.id,
      label: c.company || c.name,
      description: [c.name, c.email, c.phone].filter(Boolean).join(' · '),
      keywords: [c.name, c.email, c.phone, c.company],
    })),
    [customers],
  )

  const productOptions = useMemo(
    () => products.map(p => ({
      value: p.id,
      label: p.name,
      description: [p.sku, `${getBaseCurrencySymbol()}${p.price}`, p.category, p.stockQty != null ? `${p.stockQty} in stock` : null].filter(Boolean).join(' · '),
      keywords: [p.name, p.sku, p.category],
    })),
    [products],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (!customerId) throw new Error('Select a customer')
      if (items.some(it => !it.productId)) throw new Error('All line items must have a product')
      const res = await fetch('/api/erp/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, status, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(); onClose()
      setCustomerId(''); setStatus('pending'); setItems([{ productId: '', qty: '1' }])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sales Order {nextOrderNumber && <span className="text-muted-foreground font-mono text-sm ml-2">#{nextOrderNumber}</span>}</DialogTitle>
          <DialogDescription>Select a customer and add line items. Total is calculated from current product prices.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer *">
              <SearchableSelect
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Search by name, email, phone, company…"
                emptyMessage="No customer found"
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => {
                const p = products.find(p => p.id === it.productId)
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7">
                      <SearchableSelect
                        options={productOptions}
                        value={it.productId}
                        onChange={v => updateItem(i, 'productId', v)}
                        placeholder="Search by name, SKU, category…"
                        emptyMessage="No product found"
                        size="sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} placeholder="Qty" />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                      {p ? getBaseCurrencySymbol() : ''}{p ? (p.price * (parseInt(it.qty) || 0)).toFixed(0) : '—'}
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-muted-foreground">Order Total</span>
            <span className="text-xl font-bold tabular-nums">{getBaseCurrencySymbol()}{total.toFixed(2)}</span>
          </div>

          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Order</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Purchase Order Form (with line items) ============
export function PurchaseOrderForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState('draft')
  const [items, setItems] = useState<{ productId: string; qty: string }[]>([{ productId: '', qty: '20' }])

  useEffect(() => {
    if (open) {
      fetch('/api/erp/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || []))
      fetch('/api/erp/products').then(r => r.json()).then(d => setProducts(d.products || []))
    }
  }, [open])

  const total = items.reduce((s, it) => {
    const p = products.find(p => p.id === it.productId)
    return s + (p ? p.cost * (parseInt(it.qty) || 0) : 0)
  }, 0)

  function addItem() { setItems([...items, { productId: '', qty: '20' }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: 'productId' | 'qty', value: string) {
    setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  const supplierOptions = useMemo(
    () => suppliers.map(s => ({
      value: s.id,
      label: s.name,
      description: [s.contactName, s.email, s.phone, s.country].filter(Boolean).join(' · '),
      keywords: [s.name, s.contactName, s.email, s.country],
    })),
    [suppliers],
  )

  const productOptions = useMemo(
    () => products.map(p => ({
      value: p.id,
      label: p.name,
      description: [p.sku, `cost ${getBaseCurrencySymbol()}${p.cost}`, p.stockQty != null ? `${p.stockQty} in stock` : null].filter(Boolean).join(' · '),
      keywords: [p.name, p.sku, p.category],
    })),
    [products],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (!supplierId) throw new Error('Select a supplier')
      if (items.some(it => !it.productId)) throw new Error('All line items must have a product')
      const res = await fetch('/api/erp/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, status, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(); onClose()
      setSupplierId(''); setStatus('draft'); setItems([{ productId: '', qty: '20' }])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Select a supplier and add products to restock. Total is calculated from product cost.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier *">
              <SearchableSelect
                options={supplierOptions}
                value={supplierId}
                onChange={setSupplierId}
                placeholder="Search supplier by name, contact, country…"
                emptyMessage="No supplier found"
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'sent', 'received', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => {
                const p = products.find(p => p.id === it.productId)
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7">
                      <SearchableSelect
                        options={productOptions}
                        value={it.productId}
                        onChange={v => updateItem(i, 'productId', v)}
                        placeholder="Search product by name, SKU…"
                        emptyMessage="No product found"
                        size="sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} placeholder="Qty" />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                      {p ? getBaseCurrencySymbol() : ''}{p ? (p.cost * (parseInt(it.qty) || 0)).toFixed(0) : '—'}
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-muted-foreground">PO Total (at cost)</span>
            <span className="text-xl font-bold tabular-nums">{getBaseCurrencySymbol()}{total.toFixed(2)}</span>
          </div>

          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create PO</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Employee Form ============
export function EmployeeForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', department: 'Sales', role: 'Sales Rep',
    salary: '', hireDate: new Date().toISOString().slice(0, 10), status: 'active',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(); onClose()
      setForm({ name: '', email: '', department: 'Sales', role: 'Sales Rep', salary: '', hireDate: new Date().toISOString().slice(0, 10), status: 'active' })
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Onboard a new employee to your organization.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email *"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Department *">
              <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Executive', 'Finance', 'Sales', 'Operations', 'Engineering', 'HR'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role / Title *"><Input required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label={`Annual Salary (${getBaseCurrencySymbol()}) *`}><Input required type="number" step="1000" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="0" /></Field>
            <Field label="Hire Date"><Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Employee</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Transaction Form ============
export function TransactionForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'expense', category: 'Supplies', amount: '', description: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const INCOME_CATS = ['Product Sales', 'Service Revenue', 'Subscriptions', 'Licensing', 'Other Income']
  const EXPENSE_CATS = ['Payroll', 'Rent', 'Utilities', 'Marketing', 'Supplies', 'Software', 'Travel', 'Equipment', 'Other Expense']

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(); onClose()
      setForm({ type: 'expense', category: 'Supplies', amount: '', description: '', date: new Date().toISOString().slice(0, 10) })
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>Record a new income or expense entry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *">
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, category: v === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category *">
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(form.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Amount (${getBaseCurrencySymbol()}) *`}><Input required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="Description *"><Input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Q3 marketing campaign" /></Field>
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Transaction</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
