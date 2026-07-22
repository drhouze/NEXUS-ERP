// End-to-end test: simulate 1 visit on ACME corp tenant.
// Walks through: tenant → user → service-form template → customer → product → order → encounter → invoice render data.
// Run with: npx tsx scripts/e2e-acme-visit.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  E2E TEST: 1 visit on ACME corp (end-to-end)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ── 1. Find ACME corp tenant ───────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ name: { contains: 'ACME' } }, { name: { contains: 'Acme' } }] },
    include: {
      users: true,
      invoiceTemplate: true,
      encounterTemplate: true,
    },
  })
  if (!tenant) {
    console.log('❌ ACME corp tenant not found. Existing tenants:')
    const all = await prisma.tenant.findMany({ select: { id: true, name: true, industry: true } })
    console.table(all)
    process.exit(1)
  }
  console.log(`✅ Step 1 — Tenant found:`)
  console.log(`   • id=${tenant.id}`)
  console.log(`   • name="${tenant.name}"`)
  console.log(`   • industry="${tenant.industry}"`)
  console.log(`   • plan=${tenant.plan}, status=${tenant.status}`)
  console.log(`   • users=${tenant.users.length}`)

  // ── 2. Check user ──────────────────────────────────────────────────
  const user = tenant.users.find(u => u.role === 'TENANT_ADMIN') || tenant.users[0]
  if (!user) {
    console.log('\n❌ No user on this tenant. Cannot proceed.')
    process.exit(1)
  }
  console.log(`\n✅ Step 2 — User: ${user.email} (${user.role})`)

  // ── 3. Check / set up Service Form template ────────────────────────
  // IMPORTANT: Do NOT auto-apply any industry preset. The tenant should design
  // their own form (or pick a preset themselves from Settings → Service Form Designer).
  // For this e2e test we create a blank template and a minimal encounter so the
  // invoice can be inspected end-to-end. Tenants in production start from blank
  // or pick a preset via the UI.
  let encTemplate = tenant.encounterTemplate
  if (!encTemplate) {
    console.log('\n⚠️  No service form template yet. Creating a BLANK one (tenant designs their own)...')
    encTemplate = await prisma.encounterTemplate.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Service Form',
        sections: '[]',
        itemTables: '[]',
        showAdvice: false,
        adviceLabel: 'Notes',
        showFollowUp: false,
        followUpLabel: 'Follow-up',
        showOnInvoice: true,
      },
    })
    console.log(`   ✓ Created blank template: "${encTemplate.displayName}"`)
    console.log(`   ✓ Tenant can design it from Settings → Service Form Designer (or apply an industry preset)`)
  } else {
    console.log(`\n✅ Step 3 — Service form template exists: "${encTemplate.displayName}"`)
    const secs = JSON.parse(encTemplate.sections || '[]') as any[]
    const tabs = JSON.parse(encTemplate.itemTables || '[]') as any[]
    console.log(`   • sections=${secs.length}`)
    console.log(`   • itemTables=${tabs.length}`)
    console.log(`   • showAdvice=${encTemplate.showAdvice}, showFollowUp=${encTemplate.showFollowUp}`)
  }

  // ── 4. Ensure a customer exists ────────────────────────────────────
  let customer = await prisma.customer.findFirst({ where: { tenantId: tenant.id } })
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+60123456789',
        company: 'Doe Trading Sdn Bhd',
        status: 'active',
      },
    })
    console.log(`\n✅ Step 4 — Created customer: ${customer.name} (${customer.company})`)
  } else {
    console.log(`\n✅ Step 4 — Customer exists: ${customer.name} (${customer.company})`)
  }

  // ── 5. Ensure a product exists ─────────────────────────────────────
  let product = await prisma.product.findFirst({ where: { tenantId: tenant.id } })
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Widget Pro X1',
        sku: 'WPX-001',
        category: 'General',
        price: 150.00,
        cost: 80.00,
        stockQty: 100,
        reorderLevel: 10,
      },
    })
    console.log(`✅ Step 5 — Created product: ${product.name} @ RM${product.price}`)
  } else {
    console.log(`✅ Step 5 — Product exists: ${product.name} @ RM${product.price}`)
  }

  // ── 6. Create an order (the "visit") ───────────────────────────────
  const orderNumber = `VST-${Date.now().toString().slice(-6)}`
  const order = await prisma.salesOrder.create({
    data: {
      tenantId: tenant.id,
      orderNumber,
      customerId: customer.id,
      status: 'pending',
      total: 300.00,  // 2 × 150
      paidAmount: 0,
      items: {
        create: [
          { productId: product.id, qty: 2, unitPrice: 150.00 },
        ],
      },
    },
    include: { items: { include: { product: true } } },
  })
  console.log(`\n✅ Step 6 — Created order (visit): ${order.orderNumber}`)
  console.log(`   • customer=${customer.name}`)
  console.log(`   • status=${order.status}`)
  console.log(`   • total=RM${order.total.toFixed(2)}`)
  console.log(`   • items=${order.items.length}`)
  order.items.forEach(it => {
    console.log(`     - ${it.qty} × ${it.product.name} @ RM${it.unitPrice.toFixed(2)} = RM${(it.qty * it.unitPrice).toFixed(2)}`)
  })

  // ── 7. Fill in the service encounter ───────────────────────────────
  // Since the template is blank (tenant hasn't designed anything yet),
  // there are no sections or item tables to fill. We still create an encounter
  // record so the operator is logged, but the data object is empty.
  // Once the tenant designs their form via Settings → Service Form Designer,
  // the encounter dialog will show their custom sections/tables to fill in.
  const templateSections = JSON.parse(encTemplate.sections || '[]') as any[]
  const templateTables = JSON.parse(encTemplate.itemTables || '[]') as any[]
  const encounterData = {
    sections: {} as Record<string, any>,
    itemTables: {} as Record<string, any[]>,
  }
  const encounter = await prisma.clinicalEncounter.create({
    data: {
      tenantId: tenant.id,
      orderId: order.id,
      patientId: customer.id,
      doctorId: user.id,
      doctorName: user.name,
      data: JSON.stringify(encounterData),
      advice: encTemplate.showAdvice
        ? 'Production lead time: 5 business days. Balance due on delivery.'
        : null,
      followUpDate: encTemplate.showFollowUp
        ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        : null,
      followUpNotes: encTemplate.showFollowUp
        ? 'Call client on day 4 to confirm production status.'
        : null,
    },
  })
  console.log(`\n✅ Step 7 — Created service encounter:`)
  console.log(`   • operator=${encounter.doctorName}`)
  console.log(`   • template has ${templateSections.length} section(s), ${templateTables.length} item table(s)`)
  console.log(`   • sections filled: 0 (template is blank — tenant designs their own)`)
  console.log(`   • advice: ${encounter.advice ? 'set' : '(disabled in template)'}`)
  console.log(`   • follow-up: ${encounter.followUpDate ? 'set' : '(disabled in template)'}`)

  // ── 8. Simulate the invoice page data load ─────────────────────────
  const invoiceOrder = await prisma.salesOrder.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      tenant: { include: { invoiceTemplate: true, duitNowSettings: true, encounterTemplate: true } },
      encounter: true,
    },
  })

  console.log(`\n✅ Step 8 — Invoice page data assembled:`)
  if (!invoiceOrder) { console.log('❌ Order missing!'); process.exit(1) }
  console.log(`   • order=${invoiceOrder.orderNumber}`)
  console.log(`   • customer=${invoiceOrder.customer?.name}`)
  console.log(`   • items=${invoiceOrder.items.length}`)
  console.log(`   • payments=${invoiceOrder.payments.length}`)
  console.log(`   • tenant="${invoiceOrder.tenant?.name}"`)
  console.log(`   • invoiceTemplate exists: ${!!invoiceOrder.tenant?.invoiceTemplate}`)
  if (invoiceOrder.tenant?.invoiceTemplate) {
    const it = invoiceOrder.tenant.invoiceTemplate
    console.log(`     - clinicName="${it.clinicName}"`)
    console.log(`     - showClinicalNotes=${it.showClinicalNotes} (should be false for non-medical)`)
    console.log(`     - showPatientIC=${it.showPatientIC} (should be false)`)
  }
  console.log(`   • encounterTemplate exists: ${!!invoiceOrder.tenant?.encounterTemplate}`)
  if (invoiceOrder.tenant?.encounterTemplate) {
    const et = invoiceOrder.tenant.encounterTemplate
    console.log(`     - displayName="${et.displayName}"`)
    console.log(`     - showOnInvoice=${et.showOnInvoice}`)
    console.log(`     - sections=${JSON.parse(et.sections || '[]').length}, itemTables=${JSON.parse(et.itemTables || '[]').length}`)
  }
  console.log(`   • encounter exists: ${!!invoiceOrder.encounter}`)
  if (invoiceOrder.encounter) {
    const e = invoiceOrder.encounter
    const d = JSON.parse(e.data || '{}')
    console.log(`     - sections filled: ${Object.keys(d.sections || {}).length}`)
    console.log(`     - item tables filled: ${Object.keys(d.itemTables || {}).length}`)
    console.log(`     - advice length: ${e.advice?.length || 0}`)
    console.log(`     - followUpDate: ${e.followUpDate?.toISOString().slice(0, 10) || '—'}`)
  }

  // ── 9. Verify no medical leakage ───────────────────────────────────
  console.log(`\n🔍 Step 9 — Medical-leakage check:`)
  const it = invoiceOrder.tenant?.invoiceTemplate
  if (it) {
    const leaks = []
    if (it.showClinicalNotes) leaks.push('showClinicalNotes is true')
    if (it.showPatientIC) leaks.push('showPatientIC is true')
    if (it.clinicName === 'DR HOUZE') leaks.push('clinicName is "DR HOUZE"')
    if (leaks.length === 0) console.log('   ✅ No medical-specific defaults leaking')
    else { console.log('   ❌ Leaks:'); leaks.forEach(l => console.log(`      - ${l}`)) }
  }

  // ── 10. Final summary ──────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════`)
  console.log(`  ✅ END-TO-END VISIT COMPLETED`)
  console.log(`═══════════════════════════════════════════════════════════════`)
  console.log(`  Tenant:      ${tenant.name} (${tenant.industry})`)
  console.log(`  Customer:    ${customer.name}`)
  console.log(`  Order #:     ${order.orderNumber}`)
  console.log(`  Total:       RM${order.total.toFixed(2)}`)
  console.log(`  Encounter:   ${encounter.id}`)
  console.log(`  Invoice URL: /docs/invoice/${order.id}`)
  console.log(``)
  console.log(`  Open the invoice in the browser to verify the rendered output.`)
  console.log(`═══════════════════════════════════════════════════════════════\n`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
