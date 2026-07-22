import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Lock, ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canWrite } from '@/lib/permissions'
import { computeAge, computeAgeFromIc, parseIcToBirthDate } from '@/lib/calculated-fields'
import { CustomizableInvoice, InvoiceTemplateConfig, EncounterTemplateConfig } from '@/components/erp/customizable-invoice'

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

function parseObj(v: any): any {
  if (!v) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return {} }
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  // ---- Load order + customer + items + encounter + encounter template ----
  const order = await db.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      encounter: true,
      tenant: true,
    },
  })

  if (!order) return <div>Order not found</div>

  // Tenant isolation
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return <div>Access denied</div>
  }

  // ---- Load tenant's encounter template ----
  const encTplRow = await db.encounterTemplate.findUnique({ where: { tenantId: order.tenantId } })
  const encounterTemplate: EncounterTemplateConfig | null = encTplRow
    ? {
      displayName: encTplRow.displayName,
      sections: parseArr(encTplRow.sections),
      itemTables: parseArr(encTplRow.itemTables),
      showAdvice: encTplRow.showAdvice,
      adviceLabel: encTplRow.adviceLabel,
      showFollowUp: encTplRow.showFollowUp,
      followUpLabel: encTplRow.followUpLabel,
      showOnInvoice: encTplRow.showOnInvoice,
    }
    : null

  // ---- Server-side encounter gate ----
  // If the tenant requires an encounter before invoicing AND no encounter
  // exists (or required sections are missing), show a "locked" screen
  // instead of the invoice.
  if (encTplRow?.requireEncounterBeforeInvoice) {
    let blocked = false
    let reason = 'A completed service form (encounter) is required before this invoice can be generated.'
    if (!order.encounter) {
      blocked = true
    } else {
      const requiredIds = parseArr<string>(encTplRow.requiredSectionIds)
      if (requiredIds.length > 0) {
        const encData = parseObj(order.encounter.data)
        const sectionValues: Record<string, any> = encData.sectionValues || {}
        const missing = requiredIds.filter(sid => !sectionValues[sid] && sectionValues[sid] !== 0)
        if (missing.length > 0) {
          blocked = true
          reason = `Required service form sections are missing: ${missing.join(', ')}`
        }
      }
    }
    if (blocked) {
      return (
        <div className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-amber-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-amber-900 mb-2">Invoice Locked</h1>
            <p className="text-sm text-amber-700 mb-6">{reason}</p>
            <p className="text-xs text-muted-foreground mb-6">
              Order <span className="font-mono font-semibold">{order.orderNumber}</span> · {order.customer.company}
            </p>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </div>
        </div>
      )
    }
  }

  // ---- Load invoice template ----
  // Try unified DocumentTemplate first (this is where Settings → Document Templates saves),
  // then fall back to legacy InvoiceTemplate table for backwards compatibility.
  let template: InvoiceTemplateConfig
  let patientCustomFieldsSource: any = null

  const docTpl = await db.documentTemplate.findUnique({
    where: { tenantId_docType: { tenantId: order.tenantId, docType: 'invoice' } },
  })
  if (docTpl?.config) {
    const cfg = parseObj(docTpl.config)
    patientCustomFieldsSource = cfg.patientCustomFields ?? null
    template = {
      clinicName: cfg.businessName || cfg.clinicName || '',
      clinicPhone: cfg.phone || cfg.clinicPhone || '',
      clinicAddress: cfg.address || cfg.clinicAddress || '',
      invoiceLabel: cfg.docLabel || cfg.invoiceLabel || 'INVOICE',
      showPatientIC: cfg.showPatientIC,
      patientICLabel: cfg.patientICLabel,
      showClinicalNotes: cfg.showClinicalNotes,
      notesLabel: cfg.notesLabel,
      issueLabel: cfg.issueLabel,
      findingsLabel: cfg.findingsLabel,
      diagnosisLabel: cfg.diagnosisLabel,
      planLabel: cfg.planLabel,
      showItemNumbers: cfg.showItemNumbers ?? cfg.showItemNumber,
      itemColLabel: cfg.itemColLabel ?? cfg.colItem,
      priceColLabel: cfg.priceColLabel ?? cfg.colPrice,
      unitColLabel: cfg.unitColLabel ?? cfg.colQty,
      amountColLabel: cfg.amountColLabel ?? cfg.colAmount,
      totalLabel: cfg.totalLabel,
      currencySymbol: cfg.currencySymbol,
      showPaymentQR: cfg.showPaymentQR,
      paymentInstructions: cfg.paymentInstructions,
      footerText: cfg.footerText,
      primaryColor: cfg.primaryColor,
      fontSize: cfg.fontSize,
      patientCustomFields: cfg.patientCustomFields,
      showDiscount: cfg.showDiscount,
      discountLabel: cfg.discountLabel,
      showTax: cfg.showTax,
      taxLabel: cfg.taxLabel,
      showSubtotal: cfg.showSubtotal,
      subtotalLabel: cfg.subtotalLabel,
    }
  } else {
    // Fall back to legacy InvoiceTemplate
    let tplRow = await db.invoiceTemplate.findUnique({ where: { tenantId: order.tenantId } })
    if (!tplRow) {
      tplRow = await db.invoiceTemplate.create({ data: { tenantId: order.tenantId } })
    }
    patientCustomFieldsSource = tplRow.patientCustomFields ?? null
    template = {
      clinicName: tplRow.clinicName,
      clinicPhone: tplRow.clinicPhone,
      clinicAddress: tplRow.clinicAddress,
      invoiceLabel: tplRow.invoiceLabel,
      showPatientIC: tplRow.showPatientIC,
      patientICLabel: tplRow.patientICLabel,
      showClinicalNotes: tplRow.showClinicalNotes,
      notesLabel: tplRow.notesLabel,
      issueLabel: tplRow.issueLabel,
      findingsLabel: tplRow.findingsLabel,
      diagnosisLabel: tplRow.diagnosisLabel,
      planLabel: tplRow.planLabel,
      showItemNumbers: tplRow.showItemNumbers,
      itemColLabel: tplRow.itemColLabel,
      priceColLabel: tplRow.priceColLabel,
      unitColLabel: tplRow.unitColLabel,
      amountColLabel: tplRow.amountColLabel,
      totalLabel: tplRow.totalLabel,
      currencySymbol: tplRow.currencySymbol,
      showPaymentQR: tplRow.showPaymentQR,
      paymentInstructions: tplRow.paymentInstructions,
      footerText: tplRow.footerText,
      primaryColor: tplRow.primaryColor,
      fontSize: tplRow.fontSize,
      patientCustomFields: tplRow.patientCustomFields,
      showDiscount: tplRow.showDiscount,
      discountLabel: tplRow.discountLabel,
      showTax: tplRow.showTax,
      taxLabel: tplRow.taxLabel,
      showSubtotal: tplRow.showSubtotal,
      subtotalLabel: tplRow.subtotalLabel,
    }
  }

  // ---- Load custom field definitions for customer module ----
  const customerFieldDefs = await db.customField.findMany({
    where: { tenantId: order.tenantId, module: 'customer', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  })

  // Selected patient custom fields (those configured to show on the invoice).
  const selectedPatientFieldKeys: string[] = parseArr<any>(patientCustomFieldsSource)
    .map((f: any) => typeof f === 'string' ? f : f?.fieldKey)
    .filter(Boolean)

  const customFieldDefs = customerFieldDefs
    .filter(f => selectedPatientFieldKeys.includes(f.fieldKey))
    .map(f => ({ fieldKey: f.fieldKey, label: f.label, type: f.type }))

  // ---- Load customer custom field values ----
  const customerValues = await db.customFieldValue.findMany({
    where: { entityId: order.customerId, customField: { module: 'customer' } },
    include: { customField: true },
  })
  const patientCustomData: Record<string, string> = {}
  for (const v of customerValues) {
    if (v.customField?.fieldKey) patientCustomData[v.customField.fieldKey] = v.value
  }

  // ---- Load product custom field values (for route/strength/etc. on line items) ----
  const productIds = order.items.map(it => it.productId).filter(Boolean)
  const productFieldValues = await db.customFieldValue.findMany({
    where: { entityId: { in: productIds }, customField: { module: 'product' } },
    include: { customField: true },
  })
  // Group values by entityId → { fieldKey: value }
  const productCustomMap: Record<string, Record<string, string>> = {}
  for (const v of productFieldValues) {
    if (!productCustomMap[v.entityId]) productCustomMap[v.entityId] = {}
    if (v.customField?.fieldKey) productCustomMap[v.entityId][v.customField.fieldKey] = v.value
  }

  // ---- Build productMap with pack info + custom field values ----
  const productMap: Record<string, any> = {}
  for (const it of order.items) {
    const p = it.product
    if (!p) continue
    productMap[p.id] = {
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      packSize: p.packSize,
      packUnit: p.packUnit,
      baseUnit: p.baseUnit,
      unit: p.baseUnit, // alias used by encounter dialog
      custom: productCustomMap[p.id] || {},
    }
  }

  // ---- Compute patient age from DOB or IC ----
  const c = order.customer
  let patientAge: string | number | undefined
  if (c.dateOfBirth) {
    const a = computeAge(c.dateOfBirth as any)
    if (a !== null) patientAge = a
  } else if (c.idType && String(c.idType).toUpperCase() === 'IC' && c.idNumber) {
    const a = computeAgeFromIc(c.idNumber)
    if (a !== null) patientAge = a
  }

  const patientInfo = {
    idNumber: c.idNumber || undefined,
    age: patientAge,
    dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().slice(0, 10) : undefined,
    gender: c.gender || undefined,
    nationality: c.nationality || undefined,
    occupation: c.occupation || undefined,
  }

  // ---- Parse encounter data if present ----
  let encounter: any = null
  if (order.encounter) {
    const encData = parseObj(order.encounter.data)
    encounter = {
      sectionValues: encData.sectionValues || {},
      tableRows: encData.tableRows || {},
      advice: order.encounter.advice || encData.advice || '',
      followUpDate: order.encounter.followUpDate ? new Date(order.encounter.followUpDate).toISOString().slice(0, 10) : '',
      followUpNotes: order.encounter.followUpNotes || '',
    }
  }

  // ---- Load order notes (for the optional "Order Notes on Invoice" block) ----
  let notes: any[] = []
  try {
    notes = await db.note.findMany({
      where: { entityType: 'order', entityId: order.id },
      orderBy: { createdAt: 'asc' },
    })
  } catch {
    // Note model may not exist — skip gracefully
  }

  // canWrite check (we keep the original CustomizableInvoice with edit-via-Encounter flow).
  const canEdit = canWrite(user.role, 'orders')

  return (
    <CustomizableInvoice
      order={order}
      tenant={order.tenant}
      template={template}
      notes={notes}
      patientCustomData={patientCustomData}
      customFieldDefs={customFieldDefs}
      encounter={encounter}
      encounterTemplate={encounterTemplate}
      productMap={productMap}
      patientInfo={patientInfo}
      showBack
    />
  )
}
