'use client'

import { formatCurrency, formatDate } from './lib'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ============ Invoice Document ============
export function InvoiceDocument({ order, tenant }: { order: any; tenant: any }) {
  const balance = order.total - (order.paidAmount || 0)
  const isPaid = balance <= 0.01

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0">
      {/* Action bar (hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 print:hidden">
        <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print / Save as PDF</Button>
      </div>

      {/* Invoice paper */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12 print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-8 border-b-2 border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center">
                {tenant.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                <p className="text-sm text-gray-500">{tenant.industry}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-indigo-600 uppercase tracking-wide">INVOICE</h2>
            <p className="text-sm text-gray-500 mt-1">Invoice #: <span className="font-mono font-semibold">{order.orderNumber}</span></p>
            <p className="text-sm text-gray-500">Date: {formatDate(order.createdAt)}</p>
            <div className="mt-2">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-700' : balance < order.total ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                {isPaid ? 'PAID' : balance < order.total ? 'PARTIALLY PAID' : 'UNPAID'}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{order.customer.company}</p>
            <p className="text-sm text-gray-600">{order.customer.name}</p>
            <p className="text-sm text-gray-600">{order.customer.email}</p>
            <p className="text-sm text-gray-600">{order.customer.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">From</p>
            <p className="font-semibold text-gray-900">{tenant.name}</p>
            <p className="text-sm text-gray-600">{tenant.industry}</p>
            <p className="text-sm text-gray-600 capitalize">{tenant.plan} Plan</p>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4">SKU</th>
              <th className="pb-2 pr-4 text-center">Qty</th>
              <th className="pb-2 pr-4 text-right">Unit Price</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100 text-sm">
                <td className="py-3 pr-4 font-medium">{item.product.name}</td>
                <td className="py-3 pr-4 font-mono text-xs text-gray-500">{item.product.sku}</td>
                <td className="py-3 pr-4 text-center tabular-nums">{item.qty}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                <td className="py-3 text-right tabular-nums font-medium">{formatCurrency(item.qty * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums font-medium">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="tabular-nums">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(order.total)}</span>
            </div>
            {order.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Paid</span>
                  <span className="tabular-nums">-{formatCurrency(order.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Balance Due</span>
                  <span className="tabular-nums text-rose-600">{formatCurrency(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* DuitNow QR Payment (if balance due) */}
        {balance > 0.01 && (
          <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-200 print:bg-white print:border-gray-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-blue-600 text-white shrink-0">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor"><path d="M3 3h18v18H3V3zm6 4h-2v2h2V7zm0 4h-2v2h2v-2zm0 4h-2v2h2v-2zm8-8h-6v2h6V7zm0 4h-6v2h6v-2zm0 4h-6v2h6v-2z"/></svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Pay via DuitNow QR</p>
                <p className="text-sm text-blue-700 mt-0.5">Scan with TNG, GrabPay, Boost, or any bank app to pay {formatCurrency(balance)}. One QR for all e-wallets.</p>
                <a href={`/pay/duitnow/${order.id}`} target="_blank" className="inline-block mt-2 text-sm font-medium text-blue-700 underline">
                  Click here to pay online →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        {order.payments?.length > 0 && (
          <div className="mb-8">
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
                {order.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-4 text-gray-600">{formatDate(p.createdAt)}</td>
                    <td className="py-1.5 pr-4 capitalize text-gray-600">{p.method.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 pr-4 text-gray-600">{p.reference || '—'}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-emerald-600">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>Thank you for your business!</p>
          <p className="mt-1">{tenant.name} · {tenant.industry} · {tenant.plan.toUpperCase()} Plan</p>
        </div>
      </div>
    </div>
  )
}

// ============ Purchase Order Document ============
export function PODocument({ po, tenant }: { po: any; tenant: any }) {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 print:hidden">
        <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print / Save as PDF</Button>
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12 print:shadow-none print:rounded-none">
        <div className="flex items-start justify-between mb-8 pb-8 border-b-2 border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center">
                {tenant.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                <p className="text-sm text-gray-500">{tenant.industry}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-indigo-600 uppercase tracking-wide">PURCHASE ORDER</h2>
            <p className="text-sm text-gray-500 mt-1">PO #: <span className="font-mono font-semibold">{po.poNumber}</span></p>
            <p className="text-sm text-gray-500">Date: {formatDate(po.createdAt)}</p>
            <div className="mt-2">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${po.status === 'received' ? 'bg-emerald-100 text-emerald-700' : po.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                {po.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Supplier</p>
            <p className="font-semibold text-gray-900">{po.supplier.name}</p>
            <p className="text-sm text-gray-600">{po.supplier.contactName}</p>
            <p className="text-sm text-gray-600">{po.supplier.email}</p>
            <p className="text-sm text-gray-600">{po.supplier.phone}</p>
            <p className="text-sm text-gray-600">{po.supplier.country}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Ship To</p>
            <p className="font-semibold text-gray-900">{tenant.name}</p>
            <p className="text-sm text-gray-600">{tenant.industry}</p>
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4">SKU</th>
              <th className="pb-2 pr-4 text-center">Qty</th>
              <th className="pb-2 pr-4 text-right">Unit Cost</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100 text-sm">
                <td className="py-3 pr-4 font-medium">{item.product.name}</td>
                <td className="py-3 pr-4 font-mono text-xs text-gray-500">{item.product.sku}</td>
                <td className="py-3 pr-4 text-center tabular-nums">{item.qty}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(item.unitCost)}</td>
                <td className="py-3 text-right tabular-nums font-medium">{formatCurrency(item.qty * item.unitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums font-medium">{formatCurrency(po.total)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(po.total)}</span>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>Please send goods to the address above with this PO number.</p>
          <p className="mt-1">{tenant.name} · {tenant.industry}</p>
        </div>
      </div>
    </div>
  )
}
