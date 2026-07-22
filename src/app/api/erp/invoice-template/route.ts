import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

async function getOrCreateTemplate(tenantId: string) {
  let tpl = await db.invoiceTemplate.findUnique({ where: { tenantId } })
  if (!tpl) {
    tpl = await db.invoiceTemplate.create({ data: { tenantId } })
  }
  return tpl
}

function parseArr(v: any): any[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

// GET /api/erp/invoice-template
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const tpl = await getOrCreateTemplate(user.tenantId)

  return NextResponse.json({
    template: {
      ...tpl,
      patientCustomFields: parseArr(tpl.patientCustomFields),
    },
  })
}

// PATCH /api/erp/invoice-template
// Accepts any subset of InvoiceTemplate fields. patientCustomFields is stored
// as a JSON string (so it can be queried) but accepts either an array or a
// pre-stringified value.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const existing = await getOrCreateTemplate(user.tenantId)

    const STR_FIELDS = [
      'clinicName',
      'clinicPhone',
      'clinicAddress',
      'invoiceLabel',
      'patientICLabel',
      'notesLabel',
      'issueLabel',
      'findingsLabel',
      'diagnosisLabel',
      'planLabel',
      'itemColLabel',
      'priceColLabel',
      'unitColLabel',
      'amountColLabel',
      'totalLabel',
      'currencySymbol',
      'paymentInstructions',
      'footerText',
      'primaryColor',
      'fontSize',
      'discountLabel',
      'taxLabel',
      'subtotalLabel',
    ] as const
    const BOOL_FIELDS = [
      'showPatientIC',
      'showClinicalNotes',
      'showItemNumber',
      'showPaymentQR',
      'showDiscount',
      'showTax',
      'showSubtotal',
    ] as const

    const patch: any = {}
    for (const k of STR_FIELDS) {
      if (body[k] !== undefined) patch[k] = String(body[k])
    }
    for (const k of BOOL_FIELDS) {
      if (body[k] !== undefined) patch[k] = !!body[k]
    }
    if (body.patientCustomFields !== undefined) {
      patch.patientCustomFields = Array.isArray(body.patientCustomFields)
        ? JSON.stringify(body.patientCustomFields)
        : body.patientCustomFields == null
          ? '[]'
          : String(body.patientCustomFields)
    }

    const updated = await db.invoiceTemplate.update({ where: { tenantId: user.tenantId }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'update',
      entityType: 'invoice_template',
      entityId: updated.id,
      summary: `Updated invoice template`,
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({
      template: {
        ...updated,
        patientCustomFields: parseArr(updated.patientCustomFields),
      },
    })
  } catch (e: any) {
    console.error('Update invoice template error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
