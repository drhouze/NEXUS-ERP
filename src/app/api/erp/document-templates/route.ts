import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// ============ Document types + default configs ============

export const DOC_TYPES = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'purchase_order', label: 'Purchase Order' },
  { key: 'delivery_note', label: 'Delivery Note' },
  { key: 'statement', label: 'Statement' },
  { key: 'credit_note', label: 'Credit Note' },
] as const

export type DocTypeKey = (typeof DOC_TYPES)[number]['key']

const BASE_DEFAULT = {
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
  colSku: '',
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

const DOC_DEFAULTS: Record<string, Partial<typeof BASE_DEFAULT>> = {
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

/**
 * Returns a sensible default config for a given doc type. Used to auto-create
 * a template the first time it's requested.
 */
export function getDefaultConfig(docType: string): Record<string, any> {
  return {
    ...BASE_DEFAULT,
    ...(DOC_DEFAULTS[docType] || {}),
  }
}

// ============ Helpers ============

async function getOrCreate(tenantId: string, docType: string) {
  let tpl = await db.documentTemplate.findUnique({
    where: { tenantId_docType: { tenantId, docType } },
  })
  if (!tpl) {
    tpl = await db.documentTemplate.create({
      data: { tenantId, docType, config: JSON.stringify(getDefaultConfig(docType)) },
    })
  }
  return tpl
}

function parseConfig(v: any): Record<string, any> {
  if (!v) return {}
  if (typeof v === 'object') return v
  try {
    return JSON.parse(v)
  } catch {
    return {}
  }
}

// ============ Routes ============

// GET /api/erp/document-templates            → list all
// GET /api/erp/document-templates?docType=X  → single (auto-create if missing)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const docType = searchParams.get('docType')

  if (docType) {
    const tpl = await getOrCreate(user.tenantId, docType)
    return NextResponse.json({
      template: { ...tpl, config: parseConfig(tpl.config) },
      docTypes: DOC_TYPES,
    })
  }

  // List all (auto-creating any missing doc types so the designer has rows).
  const existing = await db.documentTemplate.findMany({ where: { tenantId: user.tenantId } })
  const byKey = new Map(existing.map(t => [t.docType, t]))
  const templates: any[] = []
  for (const { key } of DOC_TYPES) {
    const tpl = byKey.get(key) || (await getOrCreate(user.tenantId, key))
    templates.push({ ...tpl, config: parseConfig(tpl.config) })
  }

  return NextResponse.json({ templates, docTypes: DOC_TYPES })
}

// PATCH /api/erp/document-templates
// Body: { docType, config } — upserts the config for that doc type.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const docType = String(body.docType || '')
    if (!DOC_TYPES.some(d => d.key === docType)) {
      return NextResponse.json({ error: `Invalid docType: ${docType}` }, { status: 400 })
    }
    const config = body.config || {}
    const configStr = typeof config === 'string' ? config : JSON.stringify(config)

    const existing = await db.documentTemplate.findUnique({
      where: { tenantId_docType: { tenantId: user.tenantId, docType } },
    })

    let tpl
    if (existing) {
      tpl = await db.documentTemplate.update({
        where: { tenantId_docType: { tenantId: user.tenantId, docType } },
        data: { config: configStr },
      })
    } else {
      tpl = await db.documentTemplate.create({
        data: { tenantId: user.tenantId, docType, config: configStr },
      })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'update',
      entityType: 'document_template',
      entityId: tpl.id,
      summary: `Updated ${docType} document template`,
      metadata: { docType },
    })

    return NextResponse.json({
      template: { ...tpl, config: parseConfig(tpl.config) },
    })
  } catch (e: any) {
    console.error('Update document template error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
