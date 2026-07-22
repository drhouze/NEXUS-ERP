'use client'

import { useState, useEffect } from 'react'
import { formatCurrency, formatDate } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Printer, ArrowLeft, Edit, Plus, Trash2, Save, X, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { SearchableSelect } from './searchable-select'

interface EditableInvoiceProps {
  order: any
  tenant: any
  template: any
  encounter?: any
  encounterTemplate?: any
  patientInfo?: any
  productMap?: any
  customFieldDefs?: any[]
  patientCustomData?: Record<string, string>
  notes?: any[]
  products: Array<{ id: string; name: string; sku: string; price: number; productType: string }>
}

export function EditableInvoice({
  order, tenant, template, encounter, encounterTemplate, patientInfo,
  productMap, customFieldDefs, patientCustomData, notes, products,
}: EditableInvoiceProps) {
  const [editMode, setEditMode] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Initialize edit items from order
  useEffect(() => {
    if (editMode && editItems.length === 0) {
      setEditItems(order.items?.map((it: any) => ({
        productId: it.productId,
        productName: it.product?.name || '—',
        qty: String(it.qty),
        unitPrice: String(it.unitPrice),
      })) || [])
    }
  }, [editMode])

  const t = template || {}
  const primary = t.primaryColor || '#263373'
  const fontSize = t.fontSize || '12px'
  const currencySymbol = t.currencySymbol || 'RM'

  const orderTotal = typeof order.total === 'number' ? order.total : Number(order.total || 0)
  const paidAmount = typeof order.paidAmount === 'number' ? order.paidAmount : Number(order.paidAmount || 0)
  const balance = orderTotal - paidAmount

  const customer = order.customer || { name: '—', company: '' }

  function addEditItem() {
    setEditItems([...editItems, { productId: '', productName: '', qty: '1', unitPrice: '0' }])
  }

  function removeEditItem(idx: number) {
    setEditItems(editItems.filter((_, i) => i !== idx))
  }

  function updateEditItem(idx: number, field: string, value: string) {
    setEditItems(editItems.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function onProductPicked(idx: number, productId: string) {
    const p = products.find(x => x.id === productId)
    if (p) {
      updateEditItem(idx, 'productId', productId)
      updateEditItem(idx, 'productName', p.name)
      updateEditItem(idx, 'unitPrice', String(p.price))
    }
  }

  const editTotal = editItems.reduce((s, it) => s + (parseInt(it.qty) || 0) * (parseFloat(it.unitPrice) || 0), 0)

  async function saveEdit() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/erp/orders/${order.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.filter(it => it.productId),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      // Reload the page to show updated invoice
      window.location.reload()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setEditMode(false)
    setEditItems([])
    setError('')
  }

  // Refresh all line item prices to current product prices
  function refreshPrices() {
    setEditItems(prev => prev.map(it => {
      if (!it.productId) return it
      const p = products.find(x => x.id === it.productId)
      if (p) return { ...it, unitPrice: String(p.price) }
      return it
    }))
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0" style={{ fontSize }}>
      {/* Action bar */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 print:hidden">
        <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        {editMode ? (
          <>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
            <Button size="sm" variant="outline" onClick={refreshPrices} title="Update all prices to current product prices">
              <RefreshCw className="h-4 w-4 mr-2" />Refresh Prices
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print / Save as PDF</Button>
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Edit className="h-4 w-4 mr-2" />Edit Invoice</Button>
          </>
        )}
      </div>

      {/* Invoice paper */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12 print:shadow-none print:rounded-none" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2" style={{ borderColor: primary }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: primary }}>{t.clinicName || tenant?.name || ''}</h1>
            {t.clinicPhone && <p className="text-sm text-gray-600 mt-1">Tel: {t.clinicPhone}</p>}
            {t.clinicAddress && <p className="text-xs text-gray-500 mt-0.5">{t.clinicAddress}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase tracking-wide" style={{ color: primary }}>{t.invoiceLabel || 'INVOICE'}</h2>
            <p className="text-sm text-gray-500 mt-1">Invoice #: <span className="font-mono font-semibold">{order.orderNumber}</span></p>
            <p className="text-sm text-gray-500">Date: {formatDate(order.createdAt)}</p>
            {encounter?.doctorName && <p className="text-xs text-gray-500">OPERATOR: {encounter.doctorName}</p>}
          </div>
        </div>

        {/* Customer info */}
        <div className="mb-4 p-3 rounded" style={{ backgroundColor: `${primary}08` }}>
          <p className="text-sm"><strong>Bill To:</strong> {customer.name}</p>
          {patientInfo?.idNumber && (
            <p className="text-xs text-gray-700"><span style={{ color: primary }}>{patientInfo.idType || 'ID'}:</span> <span className="font-mono">{patientInfo.idNumber}</span></p>
          )}
          {patientInfo?.age !== null && patientInfo?.age !== undefined && (
            <p className="text-xs text-gray-700"><span style={{ color: primary }}>Age:</span> {patientInfo.age} years{patientInfo.gender ? ` (${patientInfo.gender})` : ''}</p>
          )}
          {customer.phone && <p className="text-xs text-gray-600">Tel: {customer.phone}</p>}
        </div>

        {/* Line items — EDIT MODE */}
        {editMode ? (
          <div className="mb-8">
            <table className="w-full" style={{ fontSize }}>
              <thead>
                <tr className="border-b-2" style={{ borderColor: primary, color: primary }}>
                  <th className="py-2 pr-2 text-left text-xs font-bold">No</th>
                  <th className="py-2 pr-2 text-left text-xs font-bold">Item</th>
                  <th className="py-2 pr-2 text-right text-xs font-bold">Price</th>
                  <th className="py-2 pr-2 text-right text-xs font-bold">Qty</th>
                  <th className="py-2 pr-2 text-right text-xs font-bold">Amount</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-xs text-gray-400">{i + 1}</td>
                    <td className="py-2 pr-2">
                      {it.productId ? (
                        <span className="text-xs">{it.productName}</span>
                      ) : (
                        <SearchableSelect
                          options={products.map(p => ({ value: p.id, label: p.name, description: `${p.sku} · ${formatCurrency(p.price)}` }))}
                          value={it.productId}
                          onChange={v => onProductPicked(i, v)}
                          placeholder="Search product..."
                          size="sm"
                          className="h-7 text-xs"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" step="0.01" className="h-7 text-xs w-20 text-right" value={it.unitPrice} onChange={e => updateEditItem(i, 'unitPrice', e.target.value)} />
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" className="h-7 text-xs w-16 text-right" value={it.qty} onChange={e => updateEditItem(i, 'qty', e.target.value)} />
                    </td>
                    <td className="py-2 pr-2 text-right text-xs tabular-nums font-medium">
                      {currencySymbol}{((parseInt(it.qty) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2)}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-500" onClick={() => removeEditItem(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button size="sm" variant="outline" className="mt-2" onClick={addEditItem}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
            <div className="flex justify-end mt-4">
              <div className="w-48">
                <div className="flex justify-between items-center py-2 px-3 rounded" style={{ backgroundColor: primary, color: 'white' }}>
                  <span className="text-sm font-bold">{t.totalLabel || 'TOTAL'}</span>
                  <span className="text-sm font-bold tabular-nums">{currencySymbol}{editTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Line items — VIEW MODE (original invoice rendering) */
          <table className="w-full mb-4" style={{ fontSize }}>
            <thead>
              <tr className="border-b-2" style={{ borderColor: primary, color: primary }}>
                {t.showItemNumber !== false && <th className="py-2 pr-2 text-left text-xs font-bold">No</th>}
                <th className="py-2 pr-2 text-left text-xs font-bold">{t.itemColLabel || 'Item'}</th>
                <th className="py-2 pr-2 text-right text-xs font-bold">{t.priceColLabel || 'Price'}</th>
                <th className="py-2 pr-2 text-right text-xs font-bold">{t.unitColLabel || 'Qty'}</th>
                <th className="py-2 text-right text-xs font-bold">{t.amountColLabel || 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item: any, i: number) => {
                const unitPrice = Number(item.unitPrice || 0)
                const qty = Number(item.qty || 0)
                const productName = item.product?.name || '—'
                return (
                  <tr key={i} className="border-b border-gray-100">
                    {t.showItemNumber !== false && <td className="py-2 pr-2 text-xs">{i + 1}</td>}
                    <td className="py-2 pr-2 text-xs">{productName}</td>
                    <td className="py-2 pr-2 text-right text-xs tabular-nums">{currencySymbol}{unitPrice.toFixed(2)}</td>
                    <td className="py-2 pr-2 text-right text-xs tabular-nums">{qty}</td>
                    <td className="py-2 text-right text-xs tabular-nums">{currencySymbol}{(qty * unitPrice).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Totals — only show in view mode (edit mode has its own total above) */}
        {!editMode && (
          <div className="flex justify-end mb-6">
            <div className="w-48">
              <div className="flex justify-between items-center py-2 px-3 rounded" style={{ backgroundColor: primary, color: 'white' }}>
                <span className="text-sm font-bold">{t.totalLabel || 'TOTAL TO PAY'}</span>
                <span className="text-sm font-bold tabular-nums">{currencySymbol}{orderTotal.toFixed(2)}</span>
              </div>
              {paidAmount > 0 && (
                <>
                  <div className="flex justify-between py-1 px-3 text-xs">
                    <span className="text-gray-600">Deposit / Paid</span>
                    <span className="tabular-nums text-emerald-600">-{currencySymbol}{paidAmount.toFixed(2)}</span>
                  </div>
                  {balance > 0.01 ? (
                    <div className="flex justify-between py-1 px-3 text-xs font-bold">
                      <span>Balance Due</span>
                      <span className="tabular-nums text-rose-600">{currencySymbol}{balance.toFixed(2)}</span>
                    </div>
                  ) : balance < -0.01 ? (
                    <div className="flex justify-between py-1 px-3 text-xs font-bold">
                      <span>Surplus to Refund</span>
                      <span className="tabular-nums text-amber-600">{currencySymbol}{Math.abs(balance).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between py-1 px-3 text-xs font-bold">
                      <span className="text-emerald-600">Fully Settled</span>
                      <span className="tabular-nums text-emerald-600">{currencySymbol}0.00</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {t.footerText && !editMode && (
          <div className="pt-8 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">{t.footerText}</p>
          </div>
        )}
      </div>
    </div>
  )
}
