// ============================================================
//  DR HOUZE CLINIC — end-to-end no-code clinical demo setup
// ============================================================
//
// This script transforms the "Acme Corp" tenant into "DR HOUZE",
// a medical clinic, and runs a full patient visit end-to-end:
//
//   1. Rename tenant: Acme Corp → DR HOUZE (industry = Medical Clinic)
//   2. Reset existing demo data (orders, customers, products, etc.)
//   3. Apply Medical preset to encounter template
//   4. Configure invoice template for clinical look
//   5. Create clinical custom fields (IC, age, gender, allergies, history, meds, surgical)
//   6. Create clinical patients with custom field values
//   7. Create clinical products (medications + services)
//   8. End-to-end visit:
//        a. Patient walk-in → create order
//        b. Patient pays deposit
//        c. Doctor fills encounter (chief complaints, findings, diagnosis, Rx, advice, follow-up)
//        d. Sync prescription as billable line items
//        e. Print invoice (verify clinical sections render)
//        f. Patient pays balance via DuitNow
//
// Run with: npx tsx scripts/setup-dr-houze-clinic.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

// Helpers
const log = (s: string) => console.log(s)
const section = (s: string) => console.log(`\n═══ ${s} ═══`)

async function main() {
  section('STEP 1 — Rename tenant → DR HOUZE (Medical Clinic)')
  const tenant = await prisma.tenant.update({
    where: { id: TENANT_ID },
    data: {
      name: 'DR HOUZE',
      industry: 'Medical Clinic',
    },
  })
  log(`✅ Tenant updated: "${tenant.name}" / industry="${tenant.industry}"`)

  section('STEP 2 — Reset existing demo data')
  // Delete in dependency order (children first)
  const del = await Promise.all([
    prisma.clinicalEncounter.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.recordNote.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.stockMovement.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } }),
  ])
  log(`   Deleted: encounters=${del[0].count}, payments=${del[1].count}, notes=${del[2].count}, stockMovements=${del[3].count}, journalEntries=${del[4].count}`)

  // Clear PO items first, then POs
  const poIds = await prisma.purchaseOrder.findMany({ where: { tenantId: TENANT_ID }, select: { id: true } })
  if (poIds.length > 0) {
    await prisma.purchaseOrderItem.deleteMany({ where: { poId: { in: poIds.map(p => p.id) } } })
  }
  const delPos = await prisma.purchaseOrder.deleteMany({ where: { tenantId: TENANT_ID } })
  log(`   Deleted: purchaseOrders=${delPos.count}`)

  // SalesOrderItem cascades from SalesOrder, but let's also clear explicitly to be safe
  const orderIds = await prisma.salesOrder.findMany({ where: { tenantId: TENANT_ID }, select: { id: true } })
  if (orderIds.length > 0) {
    await prisma.salesOrderItem.deleteMany({ where: { orderId: { in: orderIds.map(o => o.id) } } })
  }
  const delOrders = await prisma.salesOrder.deleteMany({ where: { tenantId: TENANT_ID } })
  log(`   Deleted: orders=${delOrders.count}`)

  // Clear inventory-related tables that reference products
  await Promise.all([
    prisma.batch.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.serialNumber.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.costLayer.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.stockTake.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.billOfMaterial.deleteMany({ where: { tenantId: TENANT_ID } }),
  ])

  // Custom field values must be cleared before custom fields (FK)
  const cfIds = await prisma.customField.findMany({ where: { tenantId: TENANT_ID }, select: { id: true } })
  if (cfIds.length > 0) {
    await prisma.customFieldValue.deleteMany({ where: { customFieldId: { in: cfIds.map(c => c.id) } } })
  }
  const delCf = await prisma.customField.deleteMany({ where: { tenantId: TENANT_ID } })
  log(`   Deleted: customFields=${delCf.count}`)

  // Now products, customers, suppliers can be cleared
  const delProds = await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } })
  const delCusts = await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } })
  const delSups = await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } })
  log(`   Deleted: products=${delProds.count}, customers=${delCusts.count}, suppliers=${delSups.count}`)

  section('STEP 3 — Apply Medical preset to encounter template')
  const medicalSections = [
    { id: 'chief_complaints', label: 'Chief Complaints', type: 'textarea', required: false, showOnInvoice: true, halfWidth: false },
    { id: 'findings', label: 'Examination Findings', type: 'textarea', required: false, showOnInvoice: true, halfWidth: false },
    { id: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: false, showOnInvoice: true, halfWidth: false },
  ]
  const medicalTables = [{
    id: 'prescription', label: 'Rx / Prescription', showOnInvoice: true,
    columns: [
      { id: 'drug', label: 'Drug', type: 'product' },
      { id: 'dose', label: 'Dose', type: 'text' },
      { id: 'frequency', label: 'Frequency', type: 'text' },
      { id: 'duration', label: 'Duration', type: 'text' },
      { id: 'instructions', label: 'Instructions', type: 'text' },
    ],
  }]
  const encTemplate = await prisma.encounterTemplate.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      displayName: 'Clinical Visit',
      sections: JSON.stringify(medicalSections),
      itemTables: JSON.stringify(medicalTables),
      showAdvice: true,
      adviceLabel: 'Advice / Instructions',
      showFollowUp: true,
      followUpLabel: 'Follow-up',
      showOnInvoice: true,
    },
    update: {
      displayName: 'Clinical Visit',
      sections: JSON.stringify(medicalSections),
      itemTables: JSON.stringify(medicalTables),
      showAdvice: true,
      adviceLabel: 'Advice / Instructions',
      showFollowUp: true,
      followUpLabel: 'Follow-up',
      showOnInvoice: true,
    },
  })
  log(`✅ Encounter template set to Medical preset: "${encTemplate.displayName}"`)
  log(`   • 3 sections (Chief Complaints, Findings, Diagnosis)`)
  log(`   • 1 item table (Rx / Prescription — 5 columns)`)

  section('STEP 4 — Configure invoice template for clinical look')
  await prisma.invoiceTemplate.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      clinicName: 'DR HOUZE',
      clinicPhone: '03-1234 5678',
      clinicAddress: 'No 12, Jalan Ampang, 50050 Kuala Lumpur',
      invoiceLabel: 'INVOICE',
      showPatientIC: true,
      patientICLabel: 'IC/Passport',
      showClinicalNotes: false,
      currencySymbol: 'RM',
      totalLabel: 'TOTAL TO PAY',
      showPaymentQR: true,
      paymentInstructions: 'Scan to pay with DuitNow / TNG / Boost / all bank apps',
      footerText: 'Thank you for choosing DR HOUZE. Wishing you good health.',
      primaryColor: '#0d9488',  // teal-600 — clinical feel
      fontSize: '12px',
      patientCustomFields: JSON.stringify([
        'ic_passport_number', 'age', 'gender', 'allergies', 'medical_history', 'current_medications', 'surgical_history',
      ]),
    },
    update: {
      clinicName: 'DR HOUZE',
      clinicPhone: '03-1234 5678',
      clinicAddress: 'No 12, Jalan Ampang, 50050 Kuala Lumpur',
      showPatientIC: true,
      patientICLabel: 'IC/Passport',
      showClinicalNotes: false,
      currencySymbol: 'RM',
      totalLabel: 'TOTAL TO PAY',
      showPaymentQR: true,
      paymentInstructions: 'Scan to pay with DuitNow / TNG / Boost / all bank apps',
      footerText: 'Thank you for choosing DR HOUZE. Wishing you good health.',
      primaryColor: '#0d9488',
      fontSize: '12px',
      patientCustomFields: JSON.stringify([
        'ic_passport_number', 'age', 'gender', 'allergies', 'medical_history', 'current_medications', 'surgical_history',
      ]),
    },
  })
  log(`✅ Invoice template configured:`)
  log(`   • clinicName="DR HOUZE", phone=03-1234 5678`)
  log(`   • primaryColor=#0d9488 (teal — clinical)`)
  log(`   • 7 patient custom fields will show on invoice`)

  section('STEP 5 — Create clinical custom fields (customers module)')
  const fieldDefs = [
    { fieldKey: 'ic_passport_number', label: 'IC / Passport No.', type: 'text', isRequired: true, showInTable: true, showInForm: true },
    { fieldKey: 'age', label: 'Age', type: 'number', isRequired: false, showInTable: true, showInForm: true },
    { fieldKey: 'gender', label: 'Gender', type: 'select', options: 'Male, Female', isRequired: false, showInTable: true, showInForm: true },
    { fieldKey: 'allergies', label: 'Allergies', type: 'textarea', isRequired: false, showInTable: false, showInForm: true },
    { fieldKey: 'medical_history', label: 'Medical History', type: 'textarea', isRequired: false, showInTable: false, showInForm: true },
    { fieldKey: 'current_medications', label: 'Current Medications', type: 'textarea', isRequired: false, showInTable: false, showInForm: true },
    { fieldKey: 'surgical_history', label: 'Surgical History', type: 'textarea', isRequired: false, showInTable: false, showInForm: true },
  ]
  const createdFields: Record<string, string> = {}
  for (const f of fieldDefs) {
    const opts = f.type === 'select' && f.options ? JSON.stringify(f.options.split(',').map(s => s.trim())) : null
    const cf = await prisma.customField.create({
      data: {
        tenantId: TENANT_ID,
        module: 'customers',
        fieldKey: f.fieldKey,
        label: f.label,
        type: f.type,
        options: opts,
        isRequired: f.isRequired,
        showInTable: f.showInTable,
        showInForm: f.showInForm,
        isActive: true,
      },
    })
    createdFields[f.fieldKey] = cf.id
  }
  log(`✅ Created ${fieldDefs.length} custom fields:`)
  fieldDefs.forEach(f => log(`   • ${f.label} (${f.fieldKey}, type=${f.type})`))

  section('STEP 6 — Create clinical patients with custom field values')
  const patients = [
    {
      name: 'Ahmad bin Salleh', email: 'ahmad.salleh@email.com', phone: '+6012-345 6789',
      company: 'Self-Pay Patient', status: 'active',
      cf: {
        ic_passport_number: '800101-14-5678', age: '45', gender: 'Male',
        allergies: 'No known drug allergies',
        medical_history: 'Hypertension (5 years), on Amlodipine 5mg OD. Mild hyperlipidemia.',
        current_medications: 'Amlodipine 5mg OD, Atorvastatin 20mg ON',
        surgical_history: 'Appendectomy 2015',
      },
    },
    {
      name: 'Siti Aishah binti Rahman', email: 'siti.aishah@email.com', phone: '+6013-222 1144',
      company: 'Self-Pay Patient', status: 'active',
      cf: {
        ic_passport_number: '920515-08-1234', age: '33', gender: 'Female',
        allergies: 'Penicillin (rash), Sulfa drugs',
        medical_history: 'Asthma since childhood. Two pregnancies, both normal delivery.',
        current_medications: 'Salbutamol inhaler PRN',
        surgical_history: 'None',
      },
    },
    {
      name: 'Lim Wei Ming', email: 'lim.weiming@email.com', phone: '+6016-789 0011',
      company: 'Self-Pay Patient', status: 'active',
      cf: {
        ic_passport_number: '790822-08-8899', age: '46', gender: 'Male',
        allergies: 'No known drug allergies',
        medical_history: 'Type 2 Diabetes (10 years), on Metformin. Diabetic retinopathy early stage.',
        current_medications: 'Metformin 500mg BD, Glipizide 5mg OD',
        surgical_history: 'Cataract surgery right eye 2022',
      },
    },
    {
      name: 'Priya a/p Kumar', email: 'priya.kumar@email.com', phone: '+6011-1234 8899',
      company: 'Self-Pay Patient', status: 'active',
      cf: {
        ic_passport_number: '880303-10-4455', age: '38', gender: 'Female',
        allergies: 'NSAIDs (gastric upset)',
        medical_history: 'Migraine with aura. Iron deficiency anemia.',
        current_medications: 'Ferrous sulfate 200mg OD, Sumatriptan PRN',
        surgical_history: 'None',
      },
    },
    {
      name: 'Tan Mei Ling', email: 'tan.meiling@email.com', phone: '+6019-456 7788',
      company: 'Self-Pay Patient', status: 'active',
      cf: {
        ic_passport_number: '740711-04-6677', age: '51', gender: 'Female',
        allergies: 'Codeine (nausea)',
        medical_history: 'Hypothyroidism (8 years). Osteoporosis, post-menopausal.',
        current_medications: 'Levothyroxine 100mcg OD, Calcium + Vitamin D OD',
        surgical_history: 'Total abdominal hysterectomy 2018',
      },
    },
  ]
  const patientIds: string[] = []
  for (const p of patients) {
    const cust = await prisma.customer.create({
      data: {
        tenantId: TENANT_ID,
        name: p.name, email: p.email, phone: p.phone, company: p.company, status: p.status,
      },
    })
    patientIds.push(cust.id)
    for (const [key, value] of Object.entries(p.cf)) {
      const cfId = createdFields[key]
      if (!cfId) continue
      await prisma.customFieldValue.create({
        data: {
          tenantId: TENANT_ID,
          customFieldId: cfId,
          entityType: 'customers',
          entityId: cust.id,
          value: String(value),
        },
      })
    }
    log(`   ✓ Patient: ${p.name} (IC ${p.cf.ic_passport_number}, ${p.cf.age}${p.cf.gender === 'Male' ? 'M' : 'F'})`)
  }
  log(`✅ Created ${patients.length} patients with full clinical custom fields`)

  section('STEP 7 — Create clinical products (medications + services)')
  const products = [
    // Services
    { name: 'Consultation (Standard)', sku: 'SRV-CONS', category: 'Service', price: 80, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Consultation (Specialist)', sku: 'SRV-CONS-SP', category: 'Service', price: 200, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'IV Drip Setup', sku: 'SRV-IV', category: 'Service', price: 120, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Wound Dressing', sku: 'SRV-WND', category: 'Service', price: 50, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'ECG / 12-lead', sku: 'SRV-ECG', category: 'Service', price: 90, cost: 0, stockQty: 0, productType: 'service' },
    // Medications
    { name: 'Paracetamol 500mg', sku: 'MED-PARA-500', category: 'Medication', price: 0.50, cost: 0.10, stockQty: 5000, productType: 'product' },
    { name: 'Amoxicillin 500mg', sku: 'MED-AMOX-500', category: 'Medication', price: 1.20, cost: 0.40, stockQty: 2000, productType: 'product' },
    { name: 'Metformin 500mg', sku: 'MED-MET-500', category: 'Medication', price: 0.80, cost: 0.20, stockQty: 3000, productType: 'product' },
    { name: 'Amlodipine 5mg', sku: 'MED-AMLO-5', category: 'Medication', price: 1.50, cost: 0.50, stockQty: 1500, productType: 'product' },
    { name: 'Atorvastatin 20mg', sku: 'MED-ATOR-20', category: 'Medication', price: 2.20, cost: 0.70, stockQty: 1200, productType: 'product' },
    { name: 'Salbutamol Inhaler', sku: 'MED-SALB-INH', category: 'Medication', price: 25.00, cost: 15.00, stockQty: 200, productType: 'product' },
    { name: 'Cetirizine 10mg', sku: 'MED-CET-10', category: 'Medication', price: 0.60, cost: 0.15, stockQty: 2500, productType: 'product' },
    { name: 'Omeprazole 20mg', sku: 'MED-OME-20', category: 'Medication', price: 0.90, cost: 0.25, stockQty: 1800, productType: 'product' },
    { name: 'ORS (Oral Rehydration Salts)', sku: 'MED-ORS', category: 'Medication', price: 5.00, cost: 1.50, stockQty: 400, productType: 'product' },
  ]
  const productMap: Record<string, { id: string, name: string, price: number, sku: string }> = {}
  for (const p of products) {
    const prod = await prisma.product.create({
      data: {
        tenantId: TENANT_ID,
        name: p.name, sku: p.sku, category: p.category,
        price: p.price, cost: p.cost, stockQty: p.stockQty,
        reorderLevel: 100,
        productType: p.productType as any,
        warehouse: 'Main',
      },
    })
    productMap[p.sku] = { id: prod.id, name: prod.name, price: prod.price, sku: prod.sku }
  }
  log(`✅ Created ${products.length} products:`)
  log(`   • Services: 5 (consultation, IV drip, wound dressing, ECG)`)
  log(`   • Medications: 9 (paracetamol, amoxicillin, metformin, etc.)`)

  section('STEP 8 — Create pharmaceutical suppliers')
  const suppliers = [
    { name: 'Pharmaniaga Logistics Sdn Bhd', contactName: 'Sales Rep', email: 'orders@pharmaniaga.com', phone: '03-5513 2000', country: 'Malaysia' },
    { name: 'DKSH Healthcare Sdn Bhd', contactName: 'Account Manager', email: 'healthcare@dksh.com', phone: '03-7960 8000', country: 'Malaysia' },
  ]
  for (const s of suppliers) {
    await prisma.supplier.create({ data: { tenantId: TENANT_ID, ...s } })
  }
  log(`✅ Created ${suppliers.length} suppliers`)

  // ─────────────────────────────────────────────────────────────────
  //  END-TO-END VISIT — Ahmad bin Salleh walks in with a sore throat
  // ─────────────────────────────────────────────────────────────────
  section('🎯 STEP 9 — END-TO-END VISIT: Ahmad bin Salleh (sore throat + fever)')

  // 9a. Walk-in: create order with consultation line item
  log(`\n  [9a] Walk-in: Patient arrives at reception`)
  const patient = await prisma.customer.findFirst({
    where: { tenantId: TENANT_ID, name: 'Ahmad bin Salleh' },
  })
  if (!patient) throw new Error('Patient not found')
  log(`       Patient: ${patient.name} (IC on file)`)

  const consultation = productMap['SRV-CONS']
  const orderNumber = `VST-${Date.now().toString().slice(-6)}`
  const order = await prisma.salesOrder.create({
    data: {
      tenantId: TENANT_ID,
      orderNumber,
      customerId: patient.id,
      status: 'pending',
      total: 80.00,
      paidAmount: 0,
      currency: 'MYR',
      items: { create: [{ productId: consultation.id, qty: 1, unitPrice: 80.00 }] },
    },
    include: { items: { include: { product: true } }, customer: true },
  })
  log(`       Created order ${order.orderNumber}: 1 × Consultation = RM 80.00`)
  log(`       Status: pending (awaiting deposit)`)

  // 9b. Patient pays deposit (RM 80 consultation fee) at reception
  log(`\n  [9b] Reception: Patient pays consultation fee (deposit)`)
  const deposit = await prisma.payment.create({
    data: {
      tenantId: TENANT_ID,
      orderId: order.id,
      amount: 80.00,
      method: 'cash',
      reference: `DEP-${orderNumber}`,
    },
  })
  await prisma.salesOrder.update({
    where: { id: order.id },
    data: { paidAmount: 80.00, status: 'processing' },
  })
  log(`       Received: RM 80.00 (cash) — ref ${deposit.reference}`)
  log(`       Order status: pending → processing`)

  // 9c. Doctor sees patient — fills clinical encounter
  log(`\n  [9c] Doctor visit: Clinical encounter`)
  const doctor = await prisma.user.findFirst({
    where: { tenantId: TENANT_ID, role: 'TENANT_ADMIN' },
  })
  const amoxicillin = productMap['MED-AMOX-500']
  const paracetamol = productMap['MED-PARA-500']
  const cetirizine = productMap['MED-CET-10']

  const prescriptionRows = [
    { drug: paracetamol.id, dose: '1-2 tabs', frequency: 'TDS (3x daily)', duration: '5 days', instructions: 'After meals. Max 8 tabs/day.' },
    { drug: amoxicillin.id, dose: '1 cap', frequency: 'BD (2x daily)', duration: '5 days', instructions: 'Complete full course even if better.' },
    { drug: cetirizine.id, dose: '1 tab', frequency: 'OD (once daily)', duration: '5 days', instructions: 'At bedtime. May cause drowsiness.' },
  ]

  const encounterData = {
    sections: {
      chief_complaints: 'Fever for 3 days, sore throat, body aches. No cough or shortness of breath. Appetite reduced.',
      findings: 'T 38.5°C, BP 130/85, HR 92, RR 18, SpO2 98%.\nThroat: erythematous, no exudate. Tonsils mildly enlarged.\nNeck: no lymphadenopathy.\nLungs: clear, no wheeze.\nEars: bilateral normal.\nHeart: S1 S2 normal, no murmur.',
      diagnosis: 'Upper respiratory tract infection. Likely viral pharyngitis. Secondary bacterial infection possible — prescribe antibiotics prophylactically given patient\'s hypertensive status.',
    },
    itemTables: { prescription: prescriptionRows },
  }

  const encounter = await prisma.clinicalEncounter.create({
    data: {
      tenantId: TENANT_ID,
      orderId: order.id,
      patientId: patient.id,
      doctorId: doctor?.id,
      doctorName: doctor?.name || 'DR HOUZE',
      data: JSON.stringify(encounterData),
      advice: 'Rest adequately for 3-5 days. Increase fluid intake (water, warm soup). Gargle warm salt water 3x daily for sore throat. Avoid spicy/oily food. Return if fever persists beyond 3 days, difficulty breathing, or unable to swallow fluids.',
      followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      followUpNotes: 'Review in 5 days. If symptoms resolved, no further follow-up needed. If fever persists, consider throat swab and blood test (FBC, CRP).',
    },
  })
  log(`       Encounter ID: ${encounter.id}`)
  log(`       Operator: ${encounter.doctorName}`)
  log(`       Chief Complaints: "${(encounterData.sections.chief_complaints as string).slice(0, 60)}..."`)
  log(`       Findings: temperature, BP, throat exam, lung exam recorded`)
  log(`       Diagnosis: URTI — viral pharyngitis`)
  log(`       Prescription: ${prescriptionRows.length} items`)
  prescriptionRows.forEach(r => {
    const p = [paracetamol, amoxicillin, cetirizine].find(x => x.id === r.drug)!
    log(`         • ${p.name} — ${r.dose}, ${r.frequency}, ${r.duration}`)
  })
  log(`       Advice: "${(encounter.advice || '').slice(0, 60)}..."`)
  log(`       Follow-up: ${encounter.followUpDate?.toISOString().slice(0, 10)}`)

  // 9d. Sync prescription as billable line items (replaces the consultation-only line)
  log(`\n  [9d] Reception: Sync prescription as billable line items`)
  await prisma.salesOrderItem.deleteMany({ where: { orderId: order.id } })
  const lineItems = [
    { productId: consultation.id, qty: 1, unitPrice: 80.00 },   // Consultation
    { productId: paracetamol.id, qty: 18, unitPrice: 0.50 },    // 1-2 tabs TDS × 5 days ≈ 18 tabs
    { productId: amoxicillin.id, qty: 10, unitPrice: 1.20 },    // 1 cap BD × 5 days = 10 caps
    { productId: cetirizine.id, qty: 5, unitPrice: 0.60 },      // 1 tab OD × 5 days = 5 tabs
  ]
  let newTotal = 0
  for (const li of lineItems) {
    await prisma.salesOrderItem.create({ data: { orderId: order.id, ...li } })
    newTotal += li.qty * li.unitPrice
  }
  await prisma.salesOrder.update({ where: { id: order.id }, data: { total: newTotal } })
  log(`       Consultation + 3 medications synced to invoice`)
  log(`       New order total: RM ${newTotal.toFixed(2)}`)
  log(`       Already paid (deposit): RM 80.00`)
  log(`       Balance due: RM ${(newTotal - 80).toFixed(2)}`)

  // 9e. Print invoice
  log(`\n  [9e] Reception: Print invoice`)
  log(`       Invoice URL: /docs/invoice/${order.id}`)

  // 9f. Patient pays balance via DuitNow QR
  log(`\n  [9f] Patient pays balance via DuitNow QR`)
  const balance = newTotal - 80
  const balancePayment = await prisma.payment.create({
    data: {
      tenantId: TENANT_ID,
      orderId: order.id,
      amount: balance,
      method: 'duitnow_qr',
      reference: `DN-${Date.now()}`,
    },
  })
  await prisma.salesOrder.update({
    where: { id: order.id },
    data: { paidAmount: newTotal, status: 'delivered' },
  })
  log(`       Received: RM ${balance.toFixed(2)} (DuitNow QR) — ref ${balancePayment.reference}`)
  log(`       Order status: processing → delivered (PAID IN FULL)`)

  // ── Final summary ──────────────────────────────────────────────
  section('✅ END-TO-END VISIT COMPLETED')
  log(`\n  Patient:        ${patient.name}`)
  log(`  Visit #:        ${order.orderNumber}`)
  log(`  Total billed:   RM ${newTotal.toFixed(2)}`)
  log(`  Paid (deposit): RM 80.00 (cash)`)
  log(`  Paid (balance): RM ${balance.toFixed(2)} (DuitNow QR)`)
  log(`  Status:         DELIVERED (PAID IN FULL)`)
  log(`\n  Encounter:      ${encounter.id}`)
  log(`  Doctor:         ${encounter.doctorName}`)
  log(`  Chief complaints: Fever × 3 days, sore throat`)
  log(`  Diagnosis:      URTI — viral pharyngitis`)
  log(`  Prescription:   3 items (paracetamol, amoxicillin, cetirizine)`)
  log(`  Follow-up:      ${encounter.followUpDate?.toISOString().slice(0, 10)}`)
  log(`\n  📄 INVOICE URL: /docs/invoice/${order.id}`)
  log(`  Open it in the browser to see the full clinical invoice rendered.`)
  log(`\n═══════════════════════════════════════════════════════════════\n`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
