'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Plus, Trash2, ShoppingCart, Receipt } from 'lucide-react'
import { SearchableSelect } from './searchable-select'

interface Section {
  id: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  label: string
  options?: string[]
  required?: boolean
  showOnInvoice?: boolean
  halfWidth?: boolean
}
interface ItemTableColumn {
  id: string
  type: 'text' | 'number' | 'select' | 'product'
  label: string
  options?: string[]
}
interface ItemTable {
  id: string
  name: string
  columns: ItemTableColumn[]
}
interface Template {
  displayName: string
  sections: Section[]
  itemTables: ItemTable[]
  showAdvice: boolean
  adviceLabel: string
  showFollowUp: boolean
  followUpLabel: string
  showOnInvoice: boolean
  defaultDepositAmount?: number | null
  defaultDepositLabel?: string
}
interface Product {
  id: string
  name: string
  sku?: string
  price?: number
  packSize?: number
  unit?: string
}

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export interface EncounterDialogProps {
  orderId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: (encounter: any) => void
}

/**
 * Generic encounter renderer driven by the tenant's encounter template.
 * Loads the template + products + patient custom fields from
 * `/api/erp/clinical-encounter/[orderId]`.
 */
export function EncounterDialog({ orderId, open, onOpenChange, onSaved }: EncounterDialogProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [template, setTemplate] = React.useState<Template | null>(null)
  const [products, setProducts] = React.useState<Product[]>([])
  const [order, setOrder] = React.useState<any>(null)
  const [sectionValues, setSectionValues] = React.useState<Record<string, any>>({})
  const [tableRows, setTableRows] = React.useState<Record<string, any[]>>({})
  const [advice, setAdvice] = React.useState('')
  const [followUpDate, setFollowUpDate] = React.useState('')
  const [followUpNotes, setFollowUpNotes] = React.useState('')
  // Default ticked — prescription items added to existing order items.
  const [syncToInvoice, setSyncToInvoice] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!open || !orderId) return
    setLoading(true)
    setError('')
    fetch(`/api/erp/clinical-encounter/${orderId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Failed to load'))))
      .then(d => {
        const t = d.template || d.encounterTemplate
        const sections = parseArr<Section>(t?.sections)
        const itemTables = parseArr<ItemTable>(t?.itemTables)
        setTemplate({
          displayName: t?.displayName || 'Service Form',
          sections,
          itemTables,
          showAdvice: t?.showAdvice ?? true,
          adviceLabel: t?.adviceLabel || 'Advice / Notes',
          showFollowUp: t?.showFollowUp ?? true,
          followUpLabel: t?.followUpLabel || 'Follow-up',
          showOnInvoice: t?.showOnInvoice ?? true,
          defaultDepositAmount: t?.defaultDepositAmount,
          defaultDepositLabel: t?.defaultDepositLabel,
        })
        setProducts(d.products || [])
        setOrder(d.order || null)
        // Pre-fill any existing encounter data
        if (d.encounter) {
          setSectionValues(d.encounter.sectionValues || {})
          setTableRows(d.encounter.tableRows || {})
          setAdvice(d.encounter.advice || '')
          setFollowUpDate(d.encounter.followUpDate || '')
          setFollowUpNotes(d.encounter.followUpNotes || '')
        } else {
          setSectionValues({})
          const initRows: Record<string, any[]> = {}
          for (const tb of itemTables) initRows[tb.id] = [makeEmptyRow(tb)]
          setTableRows(initRows)
          setAdvice('')
          setFollowUpDate('')
          setFollowUpNotes('')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, orderId])

  function makeEmptyRow(tb: ItemTable): any {
    const row: any = {}
    for (const c of tb.columns) row[c.id] = c.type === 'number' ? 0 : ''
    return row
  }

  function setSection(id: string, val: any) {
    setSectionValues(prev => ({ ...prev, [id]: val }))
  }
  function setRowCell(tableId: string, rowIdx: number, colId: string, val: any) {
    setTableRows(prev => {
      const rows = [...(prev[tableId] || [])]
      rows[rowIdx] = { ...rows[rowIdx], [colId]: val }
      return { ...prev, [tableId]: rows }
    })
  }
  function addRow(tableId: string) {
    const tb = template?.itemTables.find(t => t.id === tableId)
    if (!tb) return
    setTableRows(prev => ({ ...prev, [tableId]: [...(prev[tableId] || []), makeEmptyRow(tb)] }))
  }
  function removeRow(tableId: string, idx: number) {
    setTableRows(prev => {
      const rows = [...(prev[tableId] || [])]
      rows.splice(idx, 1)
      const tb = template?.itemTables.find(t => t.id === tableId)
      return { ...prev, [tableId]: rows.length ? rows : tb ? [makeEmptyRow(tb)] : [] }
    })
  }

  // Build a preview of prescription items + total for the sync panel.
  const prescriptionItems = React.useMemo(() => {
    if (!template) return []
    const items: { productId: string; name: string; qty: number; unitPrice: number; amount: number }[] = []
    for (const tb of template.itemTables) {
      const rows = tableRows[tb.id] || []
      const productCol = tb.columns.find(c => c.type === 'product')
      const qtyCol = tb.columns.find(c => c.type === 'number')
      if (!productCol) continue
      for (const r of rows) {
        const pid = r[productCol.id]
        if (!pid) continue
        const p = products.find(x => x.id === pid)
        if (!p) continue
        const qty = qtyCol ? Number(r[qtyCol.id] || 0) : 1
        const price = p.price || 0
        items.push({ productId: p.id, name: p.name, qty, unitPrice: price, amount: qty * price })
      }
    }
    return items
  }, [template, tableRows, products])

  const prescriptionTotal = prescriptionItems.reduce((s, i) => s + i.amount, 0)

  const productOptions = React.useMemo(
    () =>
      products.map(p => ({
        value: p.id,
        label: p.name,
        description: [p.sku, p.packSize ? `${p.packSize}${p.unit || ''}/pack` : null]
          .filter(Boolean)
          .join(' · '),
        keywords: [p.sku, p.name],
      })),
    [products],
  )

  async function submit() {
    setSaving(true)
    setError('')
    try {
      if (template) {
        for (const s of template.sections) {
          if (s.required && !sectionValues[s.id]) {
            throw new Error(`${s.label} is required`)
          }
        }
      }
      const payload = {
        sectionValues,
        tableRows,
        advice,
        followUpDate,
        followUpNotes,
        syncToInvoice,
      }
      const res = await fetch(`/api/erp/clinical-encounter/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to save encounter')
      }
      const d = await res.json()
      onSaved?.(d.encounter || d)
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.displayName || 'Service Form'}</DialogTitle>
          <DialogDescription>
            {order && (
              <>
                Order <span className="font-mono">{order.orderNumber}</span> · {order.customer?.name || ''}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : template ? (
          <div className="space-y-5">
            {/* Dynamic sections */}
            {template.sections.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {template.sections.map(s => {
                  const isFull = s.type === 'textarea' || !s.halfWidth
                  return (
                    <div key={s.id} className={`space-y-1.5 ${isFull ? 'sm:col-span-2' : ''}`}>
                      <Label className="text-xs">
                        {s.label}
                        {s.required && <span className="text-rose-500 ml-0.5">*</span>}
                      </Label>
                      {s.type === 'textarea' ? (
                        <Textarea
                          value={sectionValues[s.id] || ''}
                          onChange={e => setSection(s.id, e.target.value)}
                          rows={3}
                        />
                      ) : s.type === 'number' ? (
                        <Input
                          type="number"
                          value={sectionValues[s.id] || ''}
                          onChange={e => setSection(s.id, e.target.value)}
                        />
                      ) : s.type === 'date' ? (
                        <Input
                          type="date"
                          value={sectionValues[s.id] || ''}
                          onChange={e => setSection(s.id, e.target.value)}
                        />
                      ) : s.type === 'select' ? (
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={sectionValues[s.id] || ''}
                          onChange={e => setSection(s.id, e.target.value)}
                        >
                          <option value="">—</option>
                          {(s.options || []).map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={sectionValues[s.id] || ''}
                          onChange={e => setSection(s.id, e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Item tables */}
            {template.itemTables.map(tb => (
              <div key={tb.id} className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">{tb.name}</Label>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        {tb.columns.map(c => (
                          <th key={c.id} className="text-left px-2 py-1.5 font-medium text-xs">
                            {c.label}
                          </th>
                        ))}
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tableRows[tb.id] || []).map((row, idx) => (
                        <tr key={idx} className="border-t border-border/40 align-top">
                          {tb.columns.map(c => (
                            <td key={c.id} className="px-2 py-1.5">
                              {c.type === 'product' ? (
                                <SearchableSelect
                                  options={productOptions}
                                  value={row[c.id]}
                                  onChange={v => setRowCell(tb.id, idx, c.id, v)}
                                  placeholder="Select product"
                                  size="sm"
                                />
                              ) : c.type === 'number' ? (
                                <div>
                                  <Input
                                    type="number"
                                    className="h-8"
                                    value={row[c.id]}
                                    onChange={e => setRowCell(tb.id, idx, c.id, e.target.value)}
                                  />
                                  {c.label.toLowerCase().includes('qty') && (
                                    <PackHint row={row} colId={c.id} products={products} tb={tb} />
                                  )}
                                </div>
                              ) : c.type === 'select' ? (
                                <select
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                  value={row[c.id]}
                                  onChange={e => setRowCell(tb.id, idx, c.id, e.target.value)}
                                >
                                  <option value="">—</option>
                                  {(c.options || []).map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  className="h-8"
                                  value={row[c.id]}
                                  onChange={e => setRowCell(tb.id, idx, c.id, e.target.value)}
                                />
                              )}
                            </td>
                          ))}
                          <td className="px-1 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600"
                              onClick={() => removeRow(tb.id, idx)}
                              disabled={(tableRows[tb.id] || []).length <= 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => addRow(tb.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
            ))}

            {/* Advice */}
            {template.showAdvice && (
              <div className="space-y-1.5">
                <Label className="text-xs">{template.adviceLabel}</Label>
                <Textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={3} />
              </div>
            )}

            {/* Follow-up */}
            {template.showFollowUp && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{template.followUpLabel} Date</Label>
                  <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{template.followUpLabel} Notes</Label>
                  <Input value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} />
                </div>
              </div>
            )}

            {/* Sync to invoice */}
            {prescriptionItems.length > 0 && (
              <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={syncToInvoice}
                    onCheckedChange={c => setSyncToInvoice(!!c)}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> Include prescription items on invoice
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {syncToInvoice
                        ? `Items will be ADDED to the existing order (${prescriptionItems.length} item${prescriptionItems.length !== 1 ? 's' : ''}, total ${prescriptionTotal.toFixed(2)}).`
                        : 'Items will be saved to the encounter only; the order will not change.'}
                    </p>
                  </div>
                </label>
                {syncToInvoice && (
                  <div className="rounded-md border border-border/60 bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-2 py-1">Item</th>
                          <th className="text-right px-2 py-1">Qty</th>
                          <th className="text-right px-2 py-1">Price</th>
                          <th className="text-right px-2 py-1">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionItems.map((it, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="px-2 py-1">{it.name}</td>
                            <td className="text-right px-2 py-1">{it.qty}</td>
                            <td className="text-right px-2 py-1">{it.unitPrice.toFixed(2)}</td>
                            <td className="text-right px-2 py-1 font-medium">{it.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border/60 font-medium">
                          <td colSpan={3} className="text-right px-2 py-1">Total</td>
                          <td className="text-right px-2 py-1">{prescriptionTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No template configured.</p>
        )}

        {!loading && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
              Save Encounter
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Pack-rounding suggestion shown below qty inputs. */
function PackHint({
  row,
  colId,
  products,
  tb,
}: {
  row: any
  colId: string
  products: Product[]
  tb: ItemTable
}) {
  const productCol = tb.columns.find(c => c.type === 'product')
  if (!productCol) return null
  const p = products.find(x => x.id === row[productCol.id])
  if (!p || !p.packSize || p.packSize <= 1) return null
  const qty = Number(row[colId] || 0)
  if (!qty) return null
  const packs = Math.ceil(qty / p.packSize)
  return (
    <span className="text-[10px] text-muted-foreground block mt-0.5">
      ≈ {packs} pack{packs !== 1 ? 's' : ''} of {p.packSize}
    </span>
  )
}
