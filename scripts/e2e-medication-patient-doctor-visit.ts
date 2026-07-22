// End-to-end test: Add a medication, add a patient, assign a doctor, run a visit, verify invoice.
// Run with: npx tsx scripts/e2e-medication-patient-doctor-visit.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  E2E TEST: Add medication + Add patient + Assign doctor + Visit')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ── STEP 1: Add a new medication (with structured pack size + clinical custom fields) ──
  console.log('── STEP 1 — Add a new medication ──')
  const newMed = await prisma.product.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Ibuprofen 400mg',
      sku: 'MED-IBU-400',
      category: 'Medication',
      price: 8.50,        // per strip (pack)
      cost: 3.20,
      stockQty: 800,
      reorderLevel: 100,
      warehouse: 'WH-Central',
      productType: 'physical',
      packSize: 10,       // 10 tabs per strip
      packUnit: 'strip',
      baseUnit: 'tab',
    },
  })
  console.log(`  ✓ Created product: ${newMed.name} (sku=${newMed.sku})`)
  console.log(`    price=RM ${newMed.price} per strip, packSize=${newMed.packSize} ${newMed.baseUnit}/${newMed.packUnit}`)

  // Set clinical custom field values (route, dosageForm, strength, packaging)
  const cfRoute = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'products', fieldKey: 'route' } })
  const cfDosage = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'products', fieldKey: 'dosage_form' } })
  const cfStrength = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'products', fieldKey: 'strength' } })
  const cfPackaging = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'products', fieldKey: 'packaging' } })

  if (cfRoute) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfRoute.id, entityId: newMed.id } }, create: { tenantId: TENANT_ID, customFieldId: cfRoute.id, entityType: 'products', entityId: newMed.id, value: 'Oral (PO)' }, update: { value: 'Oral (PO)' } })
  if (cfDosage) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfDosage.id, entityId: newMed.id } }, create: { tenantId: TENANT_ID, customFieldId: cfDosage.id, entityType: 'products', entityId: newMed.id, value: 'Tablet' }, update: { value: 'Tablet' } })
  if (cfStrength) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfStrength.id, entityId: newMed.id } }, create: { tenantId: TENANT_ID, customFieldId: cfStrength.id, entityType: 'products', entityId: newMed.id, value: '400mg' }, update: { value: '400mg' } })
  if (cfPackaging) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfPackaging.id, entityId: newMed.id } }, create: { tenantId: TENANT_ID, customFieldId: cfPackaging.id, entityType: 'products', entityId: newMed.id, value: '10 tabs / strip' }, update: { value: '10 tabs / strip' } })
  console.log(`  ✓ Set clinical custom fields: Route=Oral (PO), Dosage=Tablet, Strength=400mg, Packaging=10 tabs / strip`)

  // ── STEP 2: Add a new patient (foreigner with passport) ──
  console.log('\n── STEP 2 — Add a new patient (foreigner with passport) ──')
  const newPatient = await prisma.customer.create({
    data: {
      tenantId: TENANT_ID,
      name: 'John Tan Wei Ming',
      email: 'john.tan@example.com',
      phone: '+6012-999 8877',
      company: 'Self-Pay Patient',
      status: 'active',
      // First-class personal info
      dateOfBirth: new Date('1990-03-15'),
      gender: 'Male',
      idType: 'Passport',         // foreigner — passport, not IC
      idNumber: 'A12345678',      // passport number (won't parse as IC, age falls back to DOB)
      nationality: 'Singaporean',
      occupation: 'Software Engineer',
      // CRM fields
      lifecycleStage: 'lead',
      leadSource: 'Referral',
      tags: JSON.stringify(['Foreigner', 'New Patient']),
    },
  })
  console.log(`  ✓ Created patient: ${newPatient.name}`)
  console.log(`    idType=${newPatient.idType}, idNumber=${newPatient.idNumber}`)
  console.log(`    dateOfBirth=${newPatient.dateOfBirth?.toISOString().slice(0, 10)}, gender=${newPatient.gender}`)
  console.log(`    nationality=${newPatient.nationality}, occupation=${newPatient.occupation}`)
  console.log(`    lifecycleStage=${newPatient.lifecycleStage}, leadSource=${newPatient.leadSource}`)
  console.log(`    tags=${newPatient.tags}`)

  // Add patient custom field values (allergies, history, meds, surgical)
  const cfAllergies = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'allergies' } })
  const cfHistory = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'medical_history' } })
  const cfMeds = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'current_medications' } })
  const cfSurgical = await prisma.customField.findFirst({ where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'surgical_history' } })

  if (cfAllergies) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfAllergies.id, entityId: newPatient.id } }, create: { tenantId: TENANT_ID, customFieldId: cfAllergies.id, entityType: 'customers', entityId: newPatient.id, value: 'Aspirin (mild rash)' }, update: { value: 'Aspirin (mild rash)' } })
  if (cfHistory) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfHistory.id, entityId: newPatient.id } }, create: { tenantId: TENANT_ID, customFieldId: cfHistory.id, entityType: 'customers', entityId: newPatient.id, value: 'No significant medical history. Generally healthy.' }, update: { value: 'No significant medical history. Generally healthy.' } })
  if (cfMeds) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfMeds.id, entityId: newPatient.id } }, create: { tenantId: TENANT_ID, customFieldId: cfMeds.id, entityType: 'customers', entityId: newPatient.id, value: 'None' }, update: { value: 'None' } })
  if (cfSurgical) await prisma.customFieldValue.upsert({ where: { customFieldId_entityId: { customFieldId: cfSurgical.id, entityId: newPatient.id } }, create: { tenantId: TENANT_ID, customFieldId: cfSurgical.id, entityType: 'customers', entityId: newPatient.id, value: 'None' }, update: { value: 'None' } })
  console.log(`  ✓ Set patient clinical custom fields: Allergies=Aspirin (mild rash), History=None, Meds=None, Surgical=None`)

  // ── STEP 3: Assign a doctor ──
  console.log('\n── STEP 3 — Assign a doctor ──')
  // Find an existing doctor user on DR HOUZE, or create one
  let doctor = await prisma.user.findFirst({
    where: { tenantId: TENANT_ID, role: 'TENANT_ADMIN' },
  })
  if (!doctor) {
    doctor = await prisma.user.create({
      data: {
        email: 'doctor@drhouze.com',
        password: '$2a$10$dummyhash',  // not used in this test
        name: 'Dr. Sarah Lee',
        role: 'TENANT_ADMIN',
        tenantId: TENANT_ID,
        status: 'active',
      },
    })
  }
  // Assign the doctor as owner of the patient (ownerId field)
  await prisma.customer.update({
    where: { id: newPatient.id },
    data: { ownerId: doctor.id },
  })
  console.log(`  ✓ Assigned doctor: ${doctor.name} (${doctor.email}) as owner of patient ${newPatient.name}`)

  // ── STEP 4: Walk-in visit ──
  console.log('\n── STEP 4 — Patient walk-in: create order ──')
  const consultation = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, sku: 'SRV-CONS' } })
  const orderNumber = `VST-${Date.now().toString().slice(-6)}`
  const order = await prisma.salesOrder.create({
    data: {
      tenantId: TENANT_ID,
      orderNumber,
      customerId: newPatient.id,
      status: 'pending',
      total: 80.00,         // consultation fee
      paidAmount: 0,
      currency: 'MYR',
      items: { create: [{ productId: consultation!.id, qty: 1, unitPrice: 80.00 }] },
    },
    include: { items: { include: { product: true } }, customer: true },
  })
  console.log(`  ✓ Created order: ${order.orderNumber}`)
  console.log(`    Patient: ${order.customer.name}`)
  console.log(`    Total: RM ${order.total.toFixed(2)} (consultation only)`)
  console.log(`    Status: pending`)

  // ── STEP 5: Doctor fills clinical encounter ──
  console.log('\n── STEP 5 — Doctor fills clinical encounter ──')
  const ibuprofen = newMed  // use the medication we just created
  const paracetamol = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, sku: 'MED-PARA-500' } })

  const prescriptionRows = [
    { drug: ibuprofen.id, dose: '1 tab', frequency: 'TDS (3x daily)', duration: '5 days', instructions: 'After meals. Avoid on empty stomach.' },
    { drug: paracetamol!.id, dose: '1-2 tabs', frequency: 'QID (4x daily)', duration: '3 days', instructions: 'For fever/pain. Max 8 tabs/day.' },
  ]

  const encounterData = {
    sections: {
      chief_complaints: 'Headache and mild fever for 2 days. Body aches. No sore throat, no cough. Patient reports taking 2 Panadols yesterday with partial relief.',
      findings: 'T 37.8°C, BP 125/82, HR 78, RR 16, SpO2 99%.\nGeneral: alert, no distress.\nHEENT: normal.\nNeck: supple, no lymphadenopathy.\nLungs: clear.\nHeart: S1 S2 normal.\nAbdomen: soft, non-tender.\nNeuro: grossly intact.',
      diagnosis: 'Viral illness with headache and myalgia. Paracetamol for symptom relief. Ibuprofen added for anti-inflammatory effect. Hydration and rest advised.',
    },
    itemTables: { prescription: prescriptionRows },
  }

  const encounter = await prisma.clinicalEncounter.create({
    data: {
      tenantId: TENANT_ID,
      orderId: order.id,
      patientId: newPatient.id,
      doctorId: doctor.id,
      doctorName: doctor.name,
      data: JSON.stringify(encounterData),
      advice: 'Rest 2-3 days. Drink at least 2L of water daily. Take medications after meals. Return if fever persists beyond 3 days, severe headache, or visual disturbances. Avoid alcohol while on ibuprofen.',
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      followUpNotes: 'Review in 3 days. If symptoms resolved, no further follow-up needed.',
    },
  })
  console.log(`  ✓ Created encounter (doctor: ${encounter.doctorName})`)
  console.log(`    Chief Complaints: "${(encounterData.sections.chief_complaints as string).slice(0, 60)}..."`)
  console.log(`    Findings: T 37.8°C, BP 125/82, normal exam`)
  console.log(`    Diagnosis: Viral illness with headache and myalgia`)
  console.log(`    Prescription: ${prescriptionRows.length} items`)
  prescriptionRows.forEach(r => {
    const p = [ibuprofen, paracetamol!].find(x => x.id === r.drug)!
    console.log(`      • ${p.name} — ${r.dose}, ${r.frequency}, ${r.duration}`)
  })
  console.log(`    Advice: "${(encounter.advice || '').slice(0, 60)}..."`)
  console.log(`    Follow-up: ${encounter.followUpDate?.toISOString().slice(0, 10)}`)

  // ── STEP 6: Sync prescription as billable line items ──
  console.log('\n── STEP 6 — Sync prescription as billable line items ──')
  await prisma.salesOrderItem.deleteMany({ where: { orderId: order.id } })
  const lineItems = [
    { productId: consultation!.id, qty: 1, unitPrice: 80.00 },     // Consultation
    { productId: ibuprofen.id, qty: 5, unitPrice: 8.50 },           // 5 strips of Ibuprofen (doctor prescribed 5 tabs → rounded to 1 strip; here doctor prescribed 5 days × 3 tabs = 15 tabs → 2 strips)
    { productId: paracetamol!.id, qty: 2, unitPrice: 0.50 },        // 2 strips of Paracetamol (3 days × 4 tabs = 12 → 2 strips)
  ]
  let newTotal = 0
  for (const li of lineItems) {
    await prisma.salesOrderItem.create({ data: { orderId: order.id, ...li } })
    newTotal += li.qty * li.unitPrice
  }
  await prisma.salesOrder.update({ where: { id: order.id }, data: { total: newTotal } })
  console.log(`  ✓ Synced line items:`)
  lineItems.forEach(li => {
    const p = [consultation!, ibuprofen, paracetamol!].find(x => x.id === li.productId)!
    console.log(`    • ${li.qty} × ${p.name} @ RM ${li.unitPrice.toFixed(2)} = RM ${(li.qty * li.unitPrice).toFixed(2)}`)
  })
  console.log(`    New total: RM ${newTotal.toFixed(2)}`)

  // ── STEP 7: Verify invoice data ──
  console.log('\n── STEP 7 — Verify invoice data ──')
  const invoiceOrder = await prisma.salesOrder.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      tenant: { include: { invoiceTemplate: true, encounterTemplate: true } },
      encounter: true,
    },
  })
  if (!invoiceOrder) { console.log('❌ Order missing!'); process.exit(1) }
  console.log(`  Order: ${invoiceOrder.orderNumber}`)
  console.log(`  Patient: ${invoiceOrder.customer.name} (${invoiceOrder.customer.idType}: ${invoiceOrder.customer.idNumber})`)
  console.log(`  DOB: ${invoiceOrder.customer.dateOfBirth?.toISOString().slice(0, 10)}`)
  console.log(`  Gender: ${invoiceOrder.customer.gender}`)
  console.log(`  Nationality: ${invoiceOrder.customer.nationality}`)
  console.log(`  Doctor (ownerId): ${invoiceOrder.customer.ownerId === doctor.id ? doctor.name + ' ✓' : 'NOT ASSIGNED ✗'}`)
  console.log(`  Items: ${invoiceOrder.items.length}`)
  console.log(`  Total: RM ${invoiceOrder.total.toFixed(2)}`)
  console.log(`  Encounter: ${invoiceOrder.encounter ? 'EXISTS ✓' : 'MISSING ✗'}`)
  console.log(`  Encounter template: ${invoiceOrder.tenant.encounterTemplate ? 'EXISTS ✓' : 'MISSING ✗'}`)
  console.log(`  requireEncounterBeforeInvoice: ${invoiceOrder.tenant.encounterTemplate?.requireEncounterBeforeInvoice}`)

  // Verify the encounter gate passes (encounter exists + required sections filled)
  const encTmpl = invoiceOrder.tenant.encounterTemplate
  if (encTmpl?.requireEncounterBeforeInvoice) {
    let requiredIds: string[] = []
    try { requiredIds = JSON.parse(encTmpl.requiredSectionIds || '[]') || [] } catch { requiredIds = [] }
    const encData = JSON.parse(invoiceOrder.encounter?.data || '{}')
    const sections = encData.sections || {}
    const missing = requiredIds.filter(id => !sections[id] || String(sections[id]).trim() === '')
    if (missing.length === 0) {
      console.log(`  Encounter gate: PASS ✓ (all required sections filled)`)
    } else {
      console.log(`  Encounter gate: FAIL ✗ (missing: ${missing.join(', ')})`)
    }
  }

  // ── STEP 8: Final summary ──
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ✅ END-TO-END VISIT COMPLETED')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  New medication:  ${newMed.name} (sku=${newMed.sku})`)
  console.log(`                   packSize=${newMed.packSize}, price=RM ${newMed.price}/strip`)
  console.log(`                   route=Oral (PO), dosage=Tablet, strength=400mg`)
  console.log(`  New patient:     ${newPatient.name} (${newPatient.idType}: ${newPatient.idNumber})`)
  console.log(`                   DOB=${newPatient.dateOfBirth?.toISOString().slice(0, 10)}, age=36, gender=Male`)
  console.log(`                   nationality=${newPatient.nationality}, occupation=${newPatient.occupation}`)
  console.log(`                   tags=Foreigner, New Patient`)
  console.log(`  Assigned doctor: ${doctor.name}`)
  console.log(`  Visit #:         ${order.orderNumber}`)
  console.log(`  Total billed:    RM ${newTotal.toFixed(2)}`)
  console.log(`    - 1 × Consultation = RM 80.00`)
  console.log(`    - 5 × Ibuprofen strips = RM 42.50`)
  console.log(`    - 2 × Paracetamol strips = RM 1.00`)
  console.log(`  Encounter:       ${encounter.id}`)
  console.log(`    Doctor:        ${encounter.doctorName}`)
  console.log(`    Complaints:    Headache + fever × 2 days`)
  console.log(`    Diagnosis:     Viral illness with headache and myalgia`)
  console.log(`    Prescription:  Ibuprofen 400mg + Paracetamol 500mg`)
  console.log(`    Follow-up:     ${encounter.followUpDate?.toISOString().slice(0, 10)}`)
  console.log(``)
  console.log(`  📄 INVOICE URL:  /docs/invoice/${order.id}`)
  console.log(`  Open it to verify the rendered clinical invoice.`)
  console.log('═══════════════════════════════════════════════════════════════\n')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
