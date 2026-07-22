'use client'

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save, FileText } from 'lucide-react'

type DocType =
  | 'invoice'
  | 'quotation'
  | 'receipt'
  | 'purchase_order'
  | 'delivery_note'
  | 'statement'
  | 'credit_note'

const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'purchase_order', label: 'Purchase Order' },
  { key: 'delivery_note', label: 'Delivery Note' },
  { key: 'statement', label: 'Statement' },
  { key: 'credit_note', label: 'Credit Note' },
]

interface TypeConfig {
  businessName: string
  docLabel: string
  phone: string
  address: string
  primaryColor: string
  fontSize: string
  // Line items column labels
  colItem: string
  colQty: string
  colPrice: string
  colAmount: string
  colSku?: string
  // Payment / bank
  showBankDetails: boolean
  bankName: string
  bankAccount: string
  bankAccountName: string
  paymentInstructions: string
  showPaymentQR: boolean
  // Terms
  showTerms: boolean
  termsText: string
  // Signatures
  showSignature: boolean
  signatureLabel1: string
  signatureLabel2: string
  // Footer
  footerText: string
}

const DEFAULT_CONFIG: TypeConfig = {
  businessName: '',
  docLabel: '',
  phone: '',
  address: '',
  primaryColor: '#263373',
  fontSize: '12px',
  colItem: 'Item',
  colQty: 'Qty',
  colPrice: 'Unit Price',
  colAmount: 'Amount',
  showBankDetails: false,
  bankName: '',
  bankAccount: '',
  bankAccountName: '',
  paymentInstructions: '',
  showPaymentQR: true,
  showTerms: false,
  termsText: '',
  showSignature: false,
  signatureLabel1: 'Prepared by',
  signatureLabel2: 'Acknowledged by',
  footerText: 'Thank you for your business',
}

const DOC_DEFAULTS: Partial<Record<DocType, Partial<TypeConfig>>> = {
  invoice: { docLabel: 'INVOICE', showBankDetails: true, showPaymentQR: true, showSignature: false },
  quotation: {
    docLabel: 'QUOTATION',
    showTerms: true,
    showSignature: true,
    signatureLabel1: 'Prepared by',
    signatureLabel2: 'Accepted by',
  },
  receipt: {
    docLabel: 'RECEIPT',
    showBankDetails: true,
    showPaymentQR: false,
    showSignature: true,
    signatureLabel1: 'Received by',
    signatureLabel2: 'Issued by',
  },
  purchase_order: {
    docLabel: 'PURCHASE ORDER',
    showTerms: true,
    showSignature: true,
    signatureLabel1: 'Authorized by',
    signatureLabel2: 'Supplier',
  },
  delivery_note: {
    docLabel: 'DELIVERY NOTE',
    showSignature: true,
    signatureLabel1: 'Delivered by',
    signatureLabel2: 'Received by',
  },
  statement: { docLabel: 'STATEMENT' },
  credit_note: { docLabel: 'CREDIT NOTE' },
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

export function DocumentTemplateDesigner() {
  const [active, setActive] = React.useState<DocType>('invoice')
  const [configs, setConfigs] = React.useState<Record<DocType, TypeConfig>>({} as any)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [savedMsg, setSavedMsg] = React.useState('')

  React.useEffect(() => {
    fetch('/api/erp/document-templates')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const map: Partial<Record<DocType, TypeConfig>> = {}
        const list = d?.templates || (Array.isArray(d) ? d : []) || []
        for (const t of list) {
          try {
            const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : t.config || {}
            map[t.docType as DocType] = {
              ...DEFAULT_CONFIG,
              ...DOC_DEFAULTS[t.docType as DocType],
              ...cfg,
            }
          } catch {
            /* skip */
          }
        }
        setConfigs(map as Record<DocType, TypeConfig>)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cfg: TypeConfig = configs[active] || { ...DEFAULT_CONFIG, ...DOC_DEFAULTS[active] }

  function update(patch: Partial<TypeConfig>) {
    setConfigs(prev => ({
      ...prev,
      [active]: {
        ...DEFAULT_CONFIG,
        ...DOC_DEFAULTS[active],
        ...(prev[active] || {}),
        ...patch,
      },
    }))
  }

  async function save() {
    setSaving(true)
    setSavedMsg('')
    try {
      const res = await fetch('/api/erp/document-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: active, config: cfg }),
      })
      setSavedMsg(res.ok ? 'Saved' : 'Failed')
    } catch {
      setSavedMsg('Failed')
    } finally {
      setSaving(false)
    }
    setTimeout(() => setSavedMsg(''), 2000)
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading templates…</div>
  }

  const showBank = active === 'invoice' || active === 'receipt'
  const showTerms = active === 'quotation' || active === 'purchase_order'
  const showSig =
    active === 'quotation' ||
    active === 'receipt' ||
    active === 'purchase_order' ||
    active === 'delivery_note'

  return (
    <div className="space-y-5">
      {/* Doc type selector */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Document Type</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map(t => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={active === t.key ? 'default' : 'outline'}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Header */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Header</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business Name">
            <Input
              value={cfg.businessName}
              onChange={e => update({ businessName: e.target.value })}
              placeholder="e.g. Klinik Sehat"
            />
          </Field>
          <Field label="Document Label">
            <Input
              value={cfg.docLabel}
              onChange={e => update({ docLabel: e.target.value })}
              placeholder="INVOICE"
            />
          </Field>
          <Field label="Phone">
            <Input value={cfg.phone} onChange={e => update({ phone: e.target.value })} />
          </Field>
          <Field label="Primary Color">
            <div className="flex gap-2">
              <input
                type="color"
                value={cfg.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
                className="w-12 h-9 rounded-md border border-input p-1"
              />
              <Input
                value={cfg.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
              />
            </div>
          </Field>
          <Field label="Font Size">
            <Input
              value={cfg.fontSize}
              onChange={e => update({ fontSize: e.target.value })}
              placeholder="12px"
            />
          </Field>
          <Field label="Address" full>
            <Textarea
              value={cfg.address}
              onChange={e => update({ address: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      </Card>

      {/* Line items table */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Line Items Table</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Item Column">
            <Input value={cfg.colItem} onChange={e => update({ colItem: e.target.value })} />
          </Field>
          <Field label="SKU Column (omit to hide)">
            <Input
              value={cfg.colSku || ''}
              onChange={e => update({ colSku: e.target.value })}
              placeholder="e.g. SKU"
            />
          </Field>
          <Field label="Qty Column">
            <Input value={cfg.colQty} onChange={e => update({ colQty: e.target.value })} />
          </Field>
          <Field label="Price Column">
            <Input value={cfg.colPrice} onChange={e => update({ colPrice: e.target.value })} />
          </Field>
          <Field label="Amount Column">
            <Input value={cfg.colAmount} onChange={e => update({ colAmount: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Payment & bank */}
      {showBank && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Payment & Bank Details</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={!!cfg.showBankDetails}
                onCheckedChange={c => update({ showBankDetails: !!c })}
              />
              Show bank details
            </label>
          </div>
          {cfg.showBankDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Bank Name">
                <Input value={cfg.bankName} onChange={e => update({ bankName: e.target.value })} />
              </Field>
              <Field label="Account Number">
                <Input
                  value={cfg.bankAccount}
                  onChange={e => update({ bankAccount: e.target.value })}
                />
              </Field>
              <Field label="Account Name">
                <Input
                  value={cfg.bankAccountName}
                  onChange={e => update({ bankAccountName: e.target.value })}
                />
              </Field>
              <Field label="Payment Instructions" full>
                <Textarea
                  value={cfg.paymentInstructions}
                  onChange={e => update({ paymentInstructions: e.target.value })}
                  rows={2}
                />
              </Field>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={!!cfg.showPaymentQR}
              onCheckedChange={c => update({ showPaymentQR: !!c })}
            />
            Show DuitNow QR
          </label>
        </Card>
      )}

      {/* Terms */}
      {showTerms && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Terms & Conditions</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={!!cfg.showTerms}
                onCheckedChange={c => update({ showTerms: !!c })}
              />
              Show terms
            </label>
          </div>
          {cfg.showTerms && (
            <Field label="Terms Text" full>
              <Textarea
                value={cfg.termsText}
                onChange={e => update({ termsText: e.target.value })}
                rows={4}
              />
            </Field>
          )}
        </Card>
      )}

      {/* Signatures */}
      {showSig && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Signature Block</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={!!cfg.showSignature}
                onCheckedChange={c => update({ showSignature: !!c })}
              />
              Show signatures
            </label>
          </div>
          {cfg.showSignature && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Signature 1 Label">
                <Input
                  value={cfg.signatureLabel1}
                  onChange={e => update({ signatureLabel1: e.target.value })}
                />
              </Field>
              <Field label="Signature 2 Label">
                <Input
                  value={cfg.signatureLabel2}
                  onChange={e => update({ signatureLabel2: e.target.value })}
                />
              </Field>
            </div>
          )}
        </Card>
      )}

      {/* Footer */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Footer</h3>
        <Field label="Footer Text" full>
          <Textarea
            value={cfg.footerText}
            onChange={e => update({ footerText: e.target.value })}
            rows={2}
          />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save {DOC_TYPES.find(d => d.key === active)?.label} Template
        </Button>
        {savedMsg && <span className="text-sm text-muted-foreground">{savedMsg}</span>}
      </div>
    </div>
  )
}
