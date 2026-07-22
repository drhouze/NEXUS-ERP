'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, RefreshCw, DollarSign } from 'lucide-react'
import { formatDate } from './lib'

// ============ Types ============
export interface InvoiceTemplateConfig {
  clinicName: string
  clinicPhone: string
  clinicAddress?: string | null
  invoiceLabel: string
  showPatientIC?: boolean
  patientICLabel?: string
  showClinicalNotes?: boolean
  notesLabel?: string
  issueLabel?: string
  findingsLabel?: string
  diagnosisLabel?: string
  planLabel?: string
  showItemNumber?: boolean
  itemColLabel?: string
  priceColLabel?: string
  unitColLabel?: string
  amountColLabel?: string
  totalLabel?: string
  currencySymbol?: string
  showPaymentQR?: boolean
  paymentInstructions?: string | null
  footerText?: string | null
  primaryColor?: string
  fontSize?: string
  patientCustomFields?: string | null
  // Discount / tax display
  showDiscount?: boolean
  discountLabel?: string
  showTax?: boolean
  taxLabel?: string
  showSubtotal?: boolean
  subtotalLabel?: string
}

export interface EncounterSection {
  id: string
  type: string
  label: string
  options?: string[]
  required?: boolean
  showOnInvoice?: boolean
  halfWidth?: boolean
}
export interface EncounterTableColumn {
  id: string
  type: string
  label: string
}
export interface EncounterTable {
  id: string
  name: string
  columns: EncounterTableColumn[]
}
export interface EncounterTemplateConfig {
  displayName?: string
  sections?: EncounterSection[] | string
  itemTables?: EncounterTable[] | string
  showAdvice?: boolean
  adviceLabel?: string
  showFollowUp?: boolean
  followUpLabel?: string
  showOnInvoice?: boolean
}

export interface EncounterData {
  sectionValues?: Record<string, any>
  tableRows?: Record<string, any[]>
  advice?: string
  followUpDate?: string
  followUpNotes?: string
}

export interface CustomFieldDef {
  fieldKey: string
  label: string
  type: string
}

export interface Payment {
  id: string
  amount: number
  method: string
  reference?: string
  createdAt: string
}

export interface OrderItem {
  id?: string
  productId?: string
  product?: any
  qty: number
  unitPrice: number
  description?: string
}

export interface Order {
  id: string
  orderNumber: string
  total: number
  paidAmount?: number
  depositAmount?: number
  createdAt: string
  customer?: any
  items?: OrderItem[]
  payments?: Payment[]
  status?: string
}

export interface Tenant {
  id: string
  name: string
  industry?: string
  plan?: string
}

export interface PatientInfo {
  idNumber?: string
  age?: string | number
  dateOfBirth?: string
  gender?: string
  nationality?: string
  occupation?: string
  [k: string]: any
}

export interface CustomizableInvoiceProps {
  order: Order
  tenant: Tenant
  template: InvoiceTemplateConfig
  notes?: any[]
  patientCustomData?: Record<string, string>
  customFieldDefs?: CustomFieldDef[]
  encounter?: EncounterData | null
  encounterTemplate?: EncounterTemplateConfig | null
  productMap?: Record<string, any>
  patientInfo?: PatientInfo
  showBack?: boolean
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

function Row({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className={`flex justify-between text-sm ${color || 'text-gray-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Printable invoice with all clinical sections (encounter, prescription
 * tables, advice, follow-up). All styling is driven by the template
 * config: primaryColor, fontSize, currencySymbol and labels.
 */
export function CustomizableInvoice({
  order,
  tenant,
  template,
  notes,
  patientCustomData,
  customFieldDefs,
  encounter,
  encounterTemplate,
  productMap = {},
  patientInfo = {},
  showBack = true,
}: CustomizableInvoiceProps) {
  const primary = template.primaryColor || '#263373'
  const sym = template.currencySymbol || 'RM'
  const [refreshing, setRefreshing] = React.useState(false)

  async function refreshPrices() {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/erp/orders/${order.id}/refresh-prices`, { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        window.location.reload()
      } else {
        alert(d.error || 'Failed to refresh prices')
      }
    } catch {
      alert('Failed to refresh prices')
    } finally {
      setRefreshing(false)
    }
  }
  const fontSize = template.fontSize || '12px'

  const balance = (order.total || 0) - (order.paidAmount || 0)
  const paid = order.paidAmount || 0
  const deposit = order.depositAmount || 0
  const surplus = -balance // balance < 0 → surplus > 0
  const fullySettled = Math.abs(balance) < 0.01

  const fmt = (n: number) =>
    `${sym}${(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const sections = encounterTemplate ? parseArr<EncounterSection>(encounterTemplate.sections) : []
  const tables = encounterTemplate ? parseArr<EncounterTable>(encounterTemplate.itemTables) : []

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0" style={{ fontSize }}>
      {showBack && (
        <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 print:hidden">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} title="Re-fetch current order data, product prices, template settings, and encounter data">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button size="sm" variant="outline" onClick={refreshPrices} disabled={refreshing} title="Update all line item prices to current product prices and recalculate total">
            {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
            Refresh Prices
          </Button>
        </div>
      )}

      <div
        className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12 print:shadow-none print:rounded-none"
        style={{ fontSize }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b-2" style={{ borderColor: primary }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: primary }}>
              {template.clinicName || tenant.name}
            </h1>
            {template.clinicPhone && <p className="text-sm text-gray-600 mt-0.5">Tel: {template.clinicPhone}</p>}
            {template.clinicAddress && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{template.clinicAddress}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase tracking-wide" style={{ color: primary }}>
              {template.invoiceLabel || 'INVOICE'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Invoice #: <span className="font-mono font-semibold">{order.orderNumber}</span>
            </p>
            <p className="text-sm text-gray-500">Date: {formatDate(order.createdAt)}</p>
            <div className="mt-2">
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: fullySettled
                    ? '#d1fae5'
                    : balance < order.total
                      ? '#fef3c7'
                      : '#fee2e2',
                  color: fullySettled ? '#065f46' : balance < order.total ? '#92400e' : '#991b1b',
                }}
              >
                {fullySettled
                  ? 'FULLY SETTLED'
                  : balance < order.total && paid > 0
                    ? 'PARTIALLY PAID'
                    : 'UNPAID'}
              </span>
            </div>
          </div>
        </div>

        {/* Patient info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Bill To</p>
            <p className="font-semibold text-gray-900">
              {order.customer?.company || order.customer?.name || '—'}
            </p>
            {order.customer?.email && <p className="text-sm text-gray-600">{order.customer.email}</p>}
            {order.customer?.phone && <p className="text-sm text-gray-600">{order.customer.phone}</p>}
            {order.customer?.address && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{order.customer.address}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {template.showPatientIC && patientInfo.idNumber && (
              <Field label={template.patientICLabel || 'IC/Passport'} value={patientInfo.idNumber} />
            )}
            {patientInfo.age !== undefined && patientInfo.age !== '' && (
              <Field label="Age" value={String(patientInfo.age)} />
            )}
            {patientInfo.dateOfBirth && (
              <Field label="DOB" value={formatDate(patientInfo.dateOfBirth)} />
            )}
            {patientInfo.gender && <Field label="Gender" value={patientInfo.gender} />}
            {patientInfo.nationality && (
              <Field label="Nationality" value={patientInfo.nationality} />
            )}
            {patientInfo.occupation && (
              <Field label="Occupation" value={patientInfo.occupation} />
            )}
          </div>
        </div>

        {/* Patient custom fields grid */}
        {customFieldDefs && customFieldDefs.length > 0 && patientCustomData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-sm">
            {customFieldDefs.map(f => {
              const v = patientCustomData[f.fieldKey]
              if (!v) return null
              return <Field key={f.fieldKey} label={f.label} value={v} />
            })}
          </div>
        )}

        {/* Encounter sections */}
        {encounter && sections.length > 0 && (
          <div className="space-y-2 mb-6">
            {sections
              .filter(s => s.showOnInvoice !== false)
              .map(s => {
                const v = encounter.sectionValues?.[s.id]
                if (v === undefined || v === '' || v === null) return null
                return (
                  <div key={s.id} className="grid grid-cols-3 gap-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase">{s.label}</p>
                    <p className="col-span-2 text-sm text-gray-800 whitespace-pre-wrap">{String(v)}</p>
                  </div>
                )
              })}
          </div>
        )}

        {/* Encounter item tables */}
        {encounter &&
          tables.map(tb => {
            const rows = encounter.tableRows?.[tb.id] || []
            if (rows.length === 0) return null
            return (
              <div key={tb.id} className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{tb.name}</p>
                <table className="w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {tb.columns.map(c => (
                        <th
                          key={c.id}
                          className="text-left px-2 py-1 text-xs font-semibold text-gray-600 border-b border-gray-200"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {tb.columns.map(c => {
                          let val: any = r[c.id]
                          if (c.type === 'product' && val) {
                            const p = productMap[val]
                            val = p?.name || p?.sku || val
                          }
                          return (
                            <td key={c.id} className="px-2 py-1 text-gray-800">
                              {val ?? ''}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

        {/* Advice */}
        {encounter?.advice && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-0.5">
              {encounterTemplate?.adviceLabel || 'Advice'}
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{encounter.advice}</p>
          </div>
        )}

        {/* Follow-up */}
        {(encounter?.followUpDate || encounter?.followUpNotes) && (
          <div className="mb-6 grid grid-cols-3 gap-2 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">
              {encounterTemplate?.followUpLabel || 'Follow-up'}
            </p>
            <p className="col-span-2">
              {encounter.followUpDate && (
                <span className="text-gray-800">{formatDate(encounter.followUpDate)}</span>
              )}
              {encounter.followUpDate && encounter.followUpNotes && <span> · </span>}
              {encounter.followUpNotes && (
                <span className="text-gray-600">{encounter.followUpNotes}</span>
              )}
            </p>
          </div>
        )}

        {/* Clinical notes */}
        {template.showClinicalNotes && notes && notes.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
              {template.notesLabel || 'Note'}
            </p>
            {notes.map((n: any, i: number) => (
              <p key={i} className="text-sm text-gray-800 whitespace-pre-wrap mb-1">
                {n.content || n.body}
              </p>
            ))}
          </div>
        )}

        {/* Line items table */}
        <table className="w-full mb-4">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
              {template.showItemNumbers !== false && <th className="pb-2 pr-2 w-8">#</th>}
              <th className="pb-2 pr-4">{template.itemColLabel || 'Item'}</th>
              <th className="pb-2 pr-4 text-right">{template.priceColLabel || 'Price'}</th>
              <th className="pb-2 pr-4 text-center">{template.unitColLabel || 'Qty'}</th>
              <th className="pb-2 text-right">{template.amountColLabel || 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it, i) => {
              const p = it.product || productMap[it.productId || '']
              const name = it.description || p?.name || '—'
              const packInfo =
                p?.packSize && p.packSize > 1 ? ` (${p.packSize}${p.unit || ''}/pack)` : ''
              return (
                <tr key={i} className="border-b border-gray-100 text-sm">
                  {template.showItemNumbers !== false && (
                    <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                  )}
                  <td className="py-2 pr-4 font-medium">
                    {name}
                    <span className="text-xs text-gray-400">{packInfo}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(it.unitPrice)}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">
                    {it.qty}
                    {packInfo && (
                      <span className="text-[10px] text-gray-400 ml-1">
                        ≈{Math.ceil(it.qty / (p?.packSize || 1))}pk
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium">{fmt(it.qty * it.unitPrice)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 space-y-1.5">
            {/* Subtotal (sum of line items before discount) */}
            {template.showSubtotal !== false && (
              <Row label={template.subtotalLabel || 'Subtotal'} value={fmt(order.subtotal || order.total)} />
            )}
            {/* Discount */}
            {template.showDiscount !== false && order.discountAmount && order.discountAmount > 0 && (
              <Row
                label={`${template.discountLabel || 'Discount'}${order.discountType === 'percentage' ? ` (${order.discountValue}%)` : ''}`}
                value={`-${fmt(order.discountAmount)}`}
                color="text-amber-600"
              />
            )}
            {/* Tax */}
            {template.showTax !== false && order.taxAmount && order.taxAmount > 0 && (
              <Row
                label={`${template.taxLabel || 'Tax'}${order.taxRate ? ` (${order.taxRate}%)` : ''}`}
                value={fmt(order.taxAmount)}
              />
            )}
            {deposit > 0 && <Row label="Deposit" value={`-${fmt(deposit)}`} />}
            <div
              className="flex justify-between font-bold text-base pt-2 border-t-2 border-gray-200"
              style={{ color: primary }}
            >
              <span>{template.totalLabel || 'TOTAL TO PAY'}</span>
              <span className="tabular-nums">{fmt(order.total)}</span>
            </div>
            {paid > 0 && <Row label="Paid" value={`-${fmt(paid)}`} color="text-emerald-600" />}
            {!fullySettled && paid > 0 && (
              <Row label="Balance Due" value={fmt(balance)} color="text-rose-600 font-semibold" />
            )}
            {fullySettled && paid > 0 && (
              <Row label="Status" value="FULLY SETTLED" color="text-emerald-600 font-semibold" />
            )}
            {surplus > 0.01 && (
              <Row label="Surplus to Refund" value={fmt(surplus)} color="text-amber-600 font-semibold" />
            )}
          </div>
        </div>

        {/* DuitNow QR */}
        {template.showPaymentQR !== false && balance > 0.01 && (
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{ backgroundColor: `${primary}10`, borderColor: `${primary}40` }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                style={{ backgroundColor: primary }}
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                  <path d="M3 3h18v18H3V3zm6 4h-2v2h2V7zm0 4h-2v2h2v-2zm0 4h-2v2h2v-2zm8-8h-6v2h6V7zm0 4h-6v2h6v-2zm0 4h-6v2h6v-2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: primary }}>
                  Pay via DuitNow QR
                </p>
                <p className="text-sm mt-0.5" style={{ color: primary }}>
                  {template.paymentInstructions ||
                    'Scan with TNG, GrabPay, Boost, or any bank app.'}
                </p>
                <a
                  href={`/pay/duitnow/${order.id}`}
                  target="_blank"
                  className="inline-block mt-2 text-sm font-medium underline"
                  style={{ color: primary }}
                >
                  Click here to pay online →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Payment history */}
        {order.payments && order.payments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Payment History</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-1 pr-4">Date</th>
                  <th className="pb-1 pr-4">Method</th>
                  <th className="pb-1 pr-4">Reference</th>
                  <th className="pb-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-4 text-gray-600">{formatDate(p.createdAt)}</td>
                    <td className="py-1.5 pr-4 capitalize text-gray-600">
                      {p.method?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-1.5 pr-4 text-gray-600">{p.reference || '—'}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-emerald-600">
                      {fmt(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>{template.footerText || 'Thank you for choosing us'}</p>
          <p className="mt-1">{template.clinicName || tenant.name}</p>
        </div>
      </div>
    </div>
  )
}
