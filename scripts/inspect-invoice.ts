// Inspect the exact data the invoice page will render for a given order ID.
// Usage: npx tsx scripts/inspect-invoice.ts <orderId>

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const orderId = process.argv[2]
  if (!orderId) {
    console.error('Usage: npx tsx scripts/inspect-invoice.ts <orderId>')
    process.exit(1)
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      tenant: { include: { invoiceTemplate: true, duitNowSettings: true, encounterTemplate: true } },
      encounter: true,
    },
  })

  if (!order) {
    console.log(`❌ Order ${orderId} not found in DB`)
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  INVOICE INSPECTION')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('── ORDER ──────────────────────────────────────────────────────')
  console.log(`  id:           ${order.id}`)
  console.log(`  orderNumber:  ${order.orderNumber}`)
  console.log(`  status:       ${order.status}`)
  console.log(`  total:        ${order.total}`)
  console.log(`  paidAmount:   ${order.paidAmount}`)
  console.log(`  currency:     ${order.currency}`)
  console.log(`  createdAt:    ${order.createdAt.toISOString()}`)
  console.log(`  tenantId:     ${order.tenantId}`)
  console.log(`  customerId:   ${order.customerId}`)

  console.log('\n── CUSTOMER ───────────────────────────────────────────────────')
  if (order.customer) {
    console.log(`  name:    ${order.customer.name}`)
    console.log(`  email:   ${order.customer.email}`)
    console.log(`  phone:   ${order.customer.phone}`)
    console.log(`  company: ${order.customer.company}`)
  } else {
    console.log('  ❌ customer is NULL')
  }

  console.log('\n── ITEMS ──────────────────────────────────────────────────────')
  if (order.items.length === 0) console.log('  ⚠️  No items on this order')
  order.items.forEach((it, i) => {
    console.log(`  [${i + 1}] productId=${it.productId}`)
    console.log(`      qty=${it.qty}, unitPrice=${it.unitPrice}`)
    if (it.product) {
      console.log(`      product: ${it.product.name} (sku=${it.product.sku}, price=${it.product.price})`)
      const p = it.product as any
      const clinicalMeta = [p.strength, p.dosageForm, p.route, p.packaging].filter(Boolean).join(' · ')
      if (clinicalMeta) console.log(`      clinical: ${clinicalMeta}`)
    } else {
      console.log(`      product: ❌ MISSING`)
    }
  })

  console.log('\n── TENANT ─────────────────────────────────────────────────────')
  if (order.tenant) {
    console.log(`  name:      ${order.tenant.name}`)
    console.log(`  industry:  ${order.tenant.industry}`)
    console.log(`  plan:      ${order.tenant.plan}`)
  } else {
    console.log('  ❌ tenant is NULL')
  }

  console.log('\n── INVOICE TEMPLATE ──────────────────────────────────────────')
  const it = order.tenant?.invoiceTemplate
  if (!it) {
    console.log('  ⚠️  No invoice template — component will use defaults')
    console.log('      Defaults: clinicName="", showClinicalNotes=false, showPatientIC=false, currencySymbol="RM"')
  } else {
    console.log(`  clinicName:           "${it.clinicName}"`)
    console.log(`  clinicPhone:          "${it.clinicPhone}"`)
    console.log(`  clinicAddress:        "${it.clinicAddress}"`)
    console.log(`  invoiceLabel:         "${it.invoiceLabel}"`)
    console.log(`  showPatientIC:        ${it.showPatientIC}`)
    console.log(`  patientICLabel:       "${it.patientICLabel}"`)
    console.log(`  showClinicalNotes:    ${it.showClinicalNotes}`)
    console.log(`  notesLabel:           "${it.notesLabel}"`)
    console.log(`  showItemNumber:       ${it.showItemNumber}`)
    console.log(`  itemColLabel:         "${it.itemColLabel}"`)
    console.log(`  priceColLabel:        "${it.priceColLabel}"`)
    console.log(`  unitColLabel:         "${it.unitColLabel}"`)
    console.log(`  amountColLabel:       "${it.amountColLabel}"`)
    console.log(`  totalLabel:           "${it.totalLabel}"`)
    console.log(`  currencySymbol:       "${it.currencySymbol}"`)
    console.log(`  showPaymentQR:        ${it.showPaymentQR}`)
    console.log(`  paymentInstructions:  "${it.paymentInstructions}"`)
    console.log(`  footerText:           "${it.footerText}"`)
    console.log(`  primaryColor:         "${it.primaryColor}"`)
    console.log(`  fontSize:             "${it.fontSize}"`)
    console.log(`  patientCustomFields:  "${it.patientCustomFields}"`)
  }

  console.log('\n── ENCOUNTER TEMPLATE ────────────────────────────────────────')
  const et = order.tenant?.encounterTemplate
  if (!et) {
    console.log('  ⚠️  No encounter template — encounter sections will NOT render on invoice')
  } else {
    console.log(`  displayName:   "${et.displayName}"`)
    console.log(`  showOnInvoice: ${et.showOnInvoice}`)
    console.log(`  showAdvice:    ${et.showAdvice}`)
    console.log(`  adviceLabel:   "${et.adviceLabel}"`)
    console.log(`  showFollowUp:  ${et.showFollowUp}`)
    console.log(`  followUpLabel: "${et.followUpLabel}"`)
    const sections = JSON.parse(et.sections || '[]') as any[]
    const itemTables = JSON.parse(et.itemTables || '[]') as any[]
    console.log(`  sections (${sections.length}):`)
    sections.forEach((s, i) => {
      console.log(`    [${i}] id=${s.id}, label="${s.label}", type=${s.type}, showOnInvoice=${s.showOnInvoice}, halfWidth=${s.halfWidth}`)
    })
    console.log(`  itemTables (${itemTables.length}):`)
    itemTables.forEach((t, i) => {
      console.log(`    [${i}] id=${t.id}, label="${t.label}", showOnInvoice=${t.showOnInvoice}, columns=${t.columns.length}`)
      t.columns.forEach((c: any, j: number) => {
        console.log(`        col[${j}] id=${c.id}, label="${c.label}", type=${c.type}`)
      })
    })
  }

  console.log('\n── ENCOUNTER (the actual data) ────────────────────────────────')
  const e = order.encounter
  if (!e) {
    console.log('  ⚠️  No encounter — no service form data to show')
  } else {
    console.log(`  id:            ${e.id}`)
    console.log(`  doctorName:    ${e.doctorName || '—'}`)
    console.log(`  advice:        "${e.advice || ''}"`)
    console.log(`  followUpDate:  ${e.followUpDate?.toISOString().slice(0, 10) || '—'}`)
    console.log(`  followUpNotes: "${e.followUpNotes || ''}"`)
    let data: any = { sections: {}, itemTables: {} }
    try { data = JSON.parse(e.data || '{}') } catch { console.log('  ❌ data JSON parse failed') }
    console.log(`  data.sections:`)
    const sections = data.sections || {}
    Object.keys(sections).forEach(k => {
      const v = sections[k]
      const preview = typeof v === 'string' ? (v.length > 80 ? v.slice(0, 80) + '...' : v) : JSON.stringify(v)
      console.log(`    ${k}: "${preview}"`)
    })
    console.log(`  data.itemTables:`)
    const tables = data.itemTables || {}
    Object.keys(tables).forEach(k => {
      console.log(`    ${k}: ${Array.isArray(tables[k]) ? tables[k].length + ' row(s)' : 'NOT AN ARRAY'}`)
      if (Array.isArray(tables[k])) {
        tables[k].forEach((row: any, i: number) => {
          console.log(`      [${i}] ${JSON.stringify(row)}`)
        })
      }
    })
  }

  // ── Cross-check: what will the renderer actually show? ─────────────
  console.log('\n── RENDER PREDICTION ──────────────────────────────────────────')
  const t = it
  const showClinical = t?.showClinicalNotes ?? false
  const showIC = t?.showPatientIC ?? false
  console.log(`  Header business name: "${(t?.clinicName || order.tenant?.name || '')}"`)
  console.log(`  Will render clinical-notes block: ${showClinical ? 'YES ⚠️' : 'no'}`)
  console.log(`  Will render IC passport field:     ${showIC ? 'YES ⚠️' : 'no'}`)
  if (et && e) {
    console.log(`  Will render encounter sections:    ${et.showOnInvoice !== false ? 'YES' : 'no (showOnInvoice=false)'}`)
    console.log(`  Will render encounter item tables: ${et.showOnInvoice !== false ? 'YES' : 'no'}`)
    console.log(`  Will render advice block:          ${et.showAdvice !== false && e.advice ? 'YES' : 'no'}`)
    console.log(`  Will render follow-up block:       ${et.showFollowUp !== false && (e.followUpDate || e.followUpNotes) ? 'YES' : 'no'}`)
  }

  // ── Potential issues ────────────────────────────────────────────────
  console.log('\n── POTENTIAL ISSUES ───────────────────────────────────────────')
  const issues: string[] = []
  if (order.items.length === 0) issues.push('Order has no line items — invoice items table will show "No billable items"')
  order.items.forEach((it, i) => {
    if (!it.product) issues.push(`Item ${i + 1}: product is NULL`)
  })
  if (!order.customer) issues.push('Customer is NULL')
  if (!order.tenant) issues.push('Tenant is NULL')

  // Industry-aware leakage check — only flag medical defaults if tenant is NOT medical
  const industry = (order.tenant?.industry || '').toLowerCase()
  const isMedicalTenant = industry.includes('medic') || industry.includes('clinic') || industry.includes('health') || industry.includes('doctor') || industry.includes('dental') || industry.includes('pharma')
  if (!isMedicalTenant) {
    if (it && it.clinicName === 'DR HOUZE') issues.push('clinicName is "DR HOUZE" — medical default leaked onto non-medical tenant')
    if (it && it.showClinicalNotes) issues.push('showClinicalNotes=true — medical notes block will render on non-medical tenant')
    if (it && it.showPatientIC) issues.push('showPatientIC=true — IC passport field will render on non-medical tenant')
  }

  if (issues.length === 0) {
    console.log('  ✅ No issues detected at the data level')
  } else {
    issues.forEach(i => console.log(`  ⚠️  ${i}`))
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
