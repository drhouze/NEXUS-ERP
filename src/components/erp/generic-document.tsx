'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react'
import { formatDate } from './lib'

export type DocType =
  | 'invoice'
  | 'quotation'
  | 'receipt'
  | 'purchase_order'
  | 'delivery_note'
  | 'statement'
  | 'credit_note'

export interface GenericDocTemplateConfig {
  businessName: string
  docLabel: string
  phone: string
  address: string
  primaryColor: string
  fontSize: string
  colItem?: string
  colQty?: string
  colPrice?: string
  colAmount?: string
  colSku?: string
  showBankDetails?: boolean
  bankName?: string
  bankAccount?: string
  bankAccountName?: string
  paymentInstructions?: string
  showPaymentQR?: boolean
  showTerms?: boolean
  termsText?: string
  showSignature?: boolean
  signatureLabel1?: string
  signatureLabel2?: string
  footerText?: string
  currencySymbol?: string
}

export interface GenericDocumentProps {
  docType: DocType
  template: GenericDocTemplateConfig
  tenant: any
  order?: any
  po?: any
  payments?: any[]
  showBack?: boolean
}

/**
 * Generic printable document renderer driven by per-doc-type template
 * config. Adapts based on doc type — quotations show "TOTAL QUOTED",
 * receipts show "TOTAL PAID", invoices show paid + balance due.
 */
export function GenericDocument({
  docType,
  template,
  tenant,
  order,
  po,
  payments,
  showBack = true,
}: GenericDocumentProps) {
  const primary = template.primaryColor || '#263373'
  const fontSize = template.fontSize || '12px'
  const sym = template.currencySymbol || '$'
  const docLabel = template.docLabel || docType.replace(/_/g, ' ').toUpperCase()
  const businessName = template.businessName || tenant?.name || ''

  const isPo = docType === 'purchase_order'
  const isReceipt = docType === 'receipt'
  const isInvoice = docType === 'invoice'
  const isQuotation = docType === 'quotation'
  const isCredit = docType === 'credit_note'
  const isStatement = docType === 'statement'

  const doc = po || order
  const docNumber = isPo ? po?.poNumber : order?.orderNumber
  const lineItems: any[] = doc?.items || []
  const total = doc?.total || 0
  const paidAmount = isReceipt
    ? (payments?.reduce((s, p) => s + (p.amount || 0), 0) || doc?.paidAmount || 0)
    : order?.paidAmount || 0
  const balance = total - paidAmount
  const fullySettled = Math.abs(balance) < 0.01

  const fmt = (n: number) =>
    `${sym}${(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const totalLabel = isQuotation
    ? 'TOTAL QUOTED'
    : isReceipt
      ? 'TOTAL PAID'
      : isCredit
        ? 'TOTAL CREDIT'
        : 'TOTAL'

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
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} title="Re-fetch current data and template settings">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
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
              {businessName}
            </h1>
            {template.phone && <p className="text-sm text-gray-600 mt-0.5">Tel: {template.phone}</p>}
            {template.address && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{template.address}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase tracking-wide" style={{ color: primary }}>
              {docLabel}
            </h2>
            {docNumber && (
              <p className="text-sm text-gray-500 mt-1">
                # <span className="font-mono font-semibold">{docNumber}</span>
              </p>
            )}
            {doc?.createdAt && (
              <p className="text-sm text-gray-500">Date: {formatDate(doc.createdAt)}</p>
            )}
            {doc?.status && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                {doc.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Bill-to / Supplier */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
              {isPo ? 'Supplier' : 'Bill To'}
            </p>
            <p className="font-semibold text-gray-900">
              {isPo ? po?.supplier?.name : order?.customer?.company || order?.customer?.name}
            </p>
            {(() => {
              const c = isPo ? po?.supplier : order?.customer
              if (!c) return null
              return (
                <>
                  {!isPo && c.name && c.company && (
                    <p className="text-sm text-gray-600">{c.name}</p>
                  )}
                  {c.email && <p className="text-sm text-gray-600">{c.email}</p>}
                  {c.phone && <p className="text-sm text-gray-600">{c.phone}</p>}
                  {c.address && (
                    <p className="text-sm text-gray-600 whitespace-pre-line">{c.address}</p>
                  )}
                </>
              )
            })()}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
              {isPo ? 'Ship To' : 'From'}
            </p>
            <p className="font-semibold text-gray-900">{businessName || tenant?.name}</p>
            {tenant?.industry && <p className="text-sm text-gray-600">{tenant.industry}</p>}
            {template.address && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{template.address}</p>
            )}
          </div>
        </div>

        {/* Line items (non-statement) */}
        {!isStatement && lineItems.length > 0 && (
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
                <th className="pb-2 pr-4">{template.colItem || 'Item'}</th>
                {template.colSku && <th className="pb-2 pr-4">SKU</th>}
                <th className="pb-2 pr-4 text-center">{template.colQty || 'Qty'}</th>
                <th className="pb-2 pr-4 text-right">{template.colPrice || 'Unit Price'}</th>
                <th className="pb-2 text-right">{template.colAmount || 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => {
                const p = it.product
                const name = it.description || p?.name || '—'
                const price = it.unitPrice ?? it.unitCost ?? 0
                return (
                  <tr key={i} className="border-b border-gray-100 text-sm">
                    <td className="py-3 pr-4 font-medium">{name}</td>
                    {template.colSku && (
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                        {p?.sku || '—'}
                      </td>
                    )}
                    <td className="py-3 pr-4 text-center tabular-nums">{it.qty}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{fmt(price)}</td>
                    <td className="py-3 text-right tabular-nums font-medium">
                      {fmt(it.qty * price)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Statement: payment history ledger */}
        {isStatement && payments && payments.length > 0 && (
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4 text-right">Debit</th>
                <th className="pb-2 pr-4 text-right">Credit</th>
                <th className="pb-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 text-sm">
                  <td className="py-2 pr-4 text-gray-600">{formatDate(p.createdAt)}</td>
                  <td className="py-2 pr-4">{p.description || p.method || '—'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {p.debit ? fmt(p.debit) : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                    {p.credit ? fmt(p.credit) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {p.balance ? fmt(p.balance) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 space-y-1.5">
            {!isStatement && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmt(total)}</span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-base pt-2 border-t-2 border-gray-200"
              style={{ color: primary }}
            >
              <span>{totalLabel}</span>
              <span className="tabular-nums">
                {isReceipt ? fmt(paidAmount) : fmt(total)}
              </span>
            </div>
            {isInvoice && paidAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Paid</span>
                <span className="tabular-nums">-{fmt(paidAmount)}</span>
              </div>
            )}
            {isInvoice && !fullySettled && (
              <div className="flex justify-between text-sm font-semibold text-rose-600">
                <span>Balance Due</span>
                <span className="tabular-nums">{fmt(balance)}</span>
              </div>
            )}
            {isInvoice && fullySettled && paidAmount > 0 && (
              <div className="flex justify-between text-sm font-semibold text-emerald-600">
                <span>Status</span>
                <span>FULLY SETTLED</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment QR (invoice/receipt) */}
        {(isInvoice || isReceipt) && template.showPaymentQR !== false && (
          (isInvoice ? balance > 0.01 : true) && (
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
                    Scan to Pay
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: primary }}>
                    {template.paymentInstructions ||
                      'Scan with any bank or e-wallet app to pay instantly.'}
                  </p>
                  {order?.id && (
                    <a
                      href={`/pay/duitnow/${order.id}`}
                      target="_blank"
                      className="inline-block mt-2 text-sm font-medium underline"
                      style={{ color: primary }}
                    >
                      Click here to pay online →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* Bank details */}
        {template.showBankDetails && (isInvoice || isReceipt) && (
          <div className="mb-6 p-3 rounded border border-gray-200 bg-gray-50 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Bank Details</p>
            {template.bankName && <p>Bank: {template.bankName}</p>}
            {template.bankAccount && (
              <p>
                Account #: <span className="font-mono">{template.bankAccount}</span>
              </p>
            )}
            {template.bankAccountName && <p>Name: {template.bankAccountName}</p>}
          </div>
        )}

        {/* Terms */}
        {template.showTerms && template.termsText && (isQuotation || isPo) && (
          <div className="mb-6 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Terms & Conditions</p>
            <p className="text-gray-700 whitespace-pre-line">{template.termsText}</p>
          </div>
        )}

        {/* Signatures */}
        {template.showSignature && (
          <div className="grid grid-cols-2 gap-12 mt-12 mb-6">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500">{template.signatureLabel1 || 'Signed by'}</p>
            </div>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500">{template.signatureLabel2 || 'Signed by'}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>{template.footerText || 'Thank you for your business'}</p>
          <p className="mt-1">{businessName}</p>
        </div>
      </div>
    </div>
  )
}
