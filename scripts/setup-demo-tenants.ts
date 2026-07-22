// ============================================================
//  Transform Globex → Trading company, Stark → Medical clinic
//  ============================================================
//
// Globex Inc → Globex Trading Sdn Bhd (Trading / Distribution)
//   - Industry: Trading / Distribution
//   - Plan: Pro
//   - Base currency: USD
//   - Products: electronics, consumer goods, raw materials (trading stock)
//   - Customers: retailers, distributors, corporate buyers
//   - Suppliers: manufacturers (China, Japan, Taiwan)
//   - Orders: wholesale orders with large quantities
//   - Apply Trading preset for encounter form (Order Specs, Quality Notes)
//
// Stark Industries → HealthPrime Clinic (Medical Clinic #2)
//   - Industry: Medical Clinic
//   - Plan: Starter
//   - Base currency: MYR
//   - Products: medications + services (different from DR HOUZE — show isolation)
//   - Customers: patients (different people from DR HOUZE's patients)
//   - Suppliers: pharmaceutical distributors
//   - Orders: patient visits
//   - Apply Medical preset for encounter form
//   - Apply Medical Product custom field preset (route, dosage form, strength, packaging)

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const log = (s: string) => console.log(s)
const section = (s: string) => console.log(`\n═══ ${s} ═══`)

async function clearTenantData(tenantId: string) {
  await prisma.clinicalEncounter.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.recordNote.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.journalEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  const poIds = await prisma.purchaseOrder.findMany({ where: { tenantId }, select: { id: true } })
  if (poIds.length > 0) await prisma.purchaseOrderItem.deleteMany({ where: { poId: { in: poIds.map(p => p.id) } } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  const orderIds = await prisma.salesOrder.findMany({ where: { tenantId }, select: { id: true } })
  if (orderIds.length > 0) await prisma.salesOrderItem.deleteMany({ where: { orderId: { in: orderIds.map(o => o.id) } } })
  await prisma.salesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await Promise.all([
    prisma.batch.deleteMany({ where: { tenantId } }).catch(() => {}),
    prisma.serialNumber.deleteMany({ where: { tenantId } }).catch(() => {}),
    prisma.costLayer.deleteMany({ where: { tenantId } }).catch(() => {}),
    prisma.stockTake.deleteMany({ where: { tenantId } }).catch(() => {}),
    prisma.billOfMaterial.deleteMany({ where: { tenantId } }).catch(() => {}),
  ])
  const cfIds = await prisma.customField.findMany({ where: { tenantId }, select: { id: true } })
  if (cfIds.length > 0) await prisma.customFieldValue.deleteMany({ where: { customFieldId: { in: cfIds.map(c => c.id) } } })
  await prisma.customField.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.product.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.supplier.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.transaction.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.documentTemplate.deleteMany({ where: { tenantId } }).catch(() => {})
  log('  ✓ Cleared all existing data')
}

async function main() {
  // ═══════════════════════════════════════════════════════════
  //  GLOBEX → GLOBEX TRADING (Trading / Distribution)
  // ═══════════════════════════════════════════════════════════
  section('TRANSFORM 1: Globex Inc → Globex Trading Sdn Bhd')
  await clearTenantData('globex')

  // Update tenant
  await prisma.tenant.update({
    where: { id: 'globex' },
    data: { name: 'Globex Trading Sdn Bhd', industry: 'Trading / Distribution', plan: 'pro' },
  })
  log('  ✓ Tenant renamed: Globex Trading Sdn Bhd (Trading / Distribution, Pro)')

  // Seed currency + set USD as base
  const { seedCurrencies } = await import('../src/lib/currency')
  await seedCurrencies('globex')
  await prisma.currency.updateMany({ where: { tenantId: 'globex' }, data: { isBase: false } })
  await prisma.currency.updateMany({ where: { tenantId: 'globex', code: 'USD' }, data: { isBase: true } })
  log('  ✓ Base currency: USD')

  // Products — trading goods (electronics, consumer goods, raw materials)
  const globexProducts = [
    { name: 'USB-C Cable 1m', sku: 'ELEC-USB-C-1M', category: 'Electronics', price: 12.00, cost: 4.50, stockQty: 5000, packSize: 100, packUnit: 'box', baseUnit: 'pc' },
    { name: 'Bluetooth Earbuds Pro', sku: 'ELEC-BT-EARBUDS', category: 'Electronics', price: 89.00, cost: 35.00, stockQty: 800, packSize: 50, packUnit: 'box', baseUnit: 'pc' },
    { name: 'Power Bank 10000mAh', sku: 'ELEC-PB-10K', category: 'Electronics', price: 45.00, cost: 18.00, stockQty: 1200, packSize: 40, packUnit: 'box', baseUnit: 'pc' },
    { name: 'LED Bulb 9W (Pack of 10)', sku: 'CONS-LED-9W', category: 'Consumer Goods', price: 25.00, cost: 8.00, stockQty: 3000, packSize: 10, packUnit: 'pack', baseUnit: 'pc' },
    { name: 'AA Batteries (Pack of 24)', sku: 'CONS-BATT-AA24', category: 'Consumer Goods', price: 18.00, cost: 6.50, stockQty: 2000, packSize: 24, packUnit: 'pack', baseUnit: 'pc' },
    { name: 'Stainless Steel Water Bottle 500mL', sku: 'CONS-BOTTLE-500', category: 'Consumer Goods', price: 15.00, cost: 5.00, stockQty: 1500, packSize: 60, packUnit: 'box', baseUnit: 'pc' },
    { name: 'Copper Wire 2.5mm² (100m roll)', sku: 'RAW-CU-25', category: 'Raw Materials', price: 120.00, cost: 75.00, stockQty: 200, packSize: 1, packUnit: 'roll', baseUnit: 'roll' },
    { name: 'PVC Pipe 4-inch (6m length)', sku: 'RAW-PVC-4', category: 'Raw Materials', price: 35.00, cost: 18.00, stockQty: 500, packSize: 10, packUnit: 'bundle', baseUnit: 'pc' },
    { name: 'Industrial Grease 1kg', sku: 'RAW-GREASE-1K', category: 'Raw Materials', price: 28.00, cost: 12.00, stockQty: 800, packSize: 12, packUnit: 'box', baseUnit: 'kg' },
    { name: 'A4 Paper 80gsm (5 reams/box)', sku: 'CONS-PAPER-A4', category: 'Consumer Goods', price: 55.00, cost: 28.00, stockQty: 1000, packSize: 5, packUnit: 'box', baseUnit: 'ream' },
    { name: 'Shipping & Handling', sku: 'SRV-SHIP', category: 'Service', price: 25.00, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Warehousing Fee (monthly)', sku: 'SRV-WH-FEE', category: 'Service', price: 150.00, cost: 0, stockQty: 0, productType: 'service' },
  ]
  for (const p of globexProducts) {
    await prisma.product.create({
      data: {
        tenantId: 'globex',
        name: p.name, sku: p.sku, category: p.category,
        price: p.price, cost: p.cost, stockQty: p.stockQty,
        reorderLevel: 100, warehouse: 'WH-Central',
        productType: (p as any).productType || 'physical',
        packSize: (p as any).packSize || null,
        packUnit: (p as any).packUnit || null,
        baseUnit: (p as any).baseUnit || null,
      },
    })
  }
  log(`  ✓ Created ${globexProducts.length} products (electronics, consumer goods, raw materials, services)`)

  // Customers — retailers, distributors, corporate buyers
  const globexCustomers = [
    { name: 'Sarah Chen', email: 'sarah@techmart.my', phone: '+603-5512 8800', company: 'TechMart Retail Sdn Bhd', status: 'active', lifecycleStage: 'customer', leadSource: 'Referral', tags: ['VIP', 'Retail'] },
    { name: 'Raj Kumar', email: 'raj@megastore.sg', phone: '+65-6234 5678', company: 'MegaStore Singapore Pte Ltd', status: 'active', lifecycleStage: 'customer', leadSource: 'Website', tags: ['Wholesale', 'SG'] },
    { name: 'Ahmad Faizal', email: 'faizal@kedaielektronik.my', phone: '+607-234 1100', company: 'Kedai Elektronik JB', status: 'active', lifecycleStage: 'customer', leadSource: 'Walk-in', tags: ['Retail', 'JB'] },
    { name: 'Lim Chee Keong', email: 'lim@constructionco.my', phone: '+603-7788 9900', company: 'BuildWell Construction Sdn Bhd', status: 'active', lifecycleStage: 'customer', leadSource: 'Referral', tags: ['Corporate', 'Construction'] },
    { name: 'Priya Sharma', email: 'priya@officesupplies.my', phone: '+603-2233 4455', company: 'OfficeSupplies Malaysia', status: 'lead', lifecycleStage: 'lead', leadSource: 'Google Ads', tags: ['Lead'] },
    { name: 'Wong Kap Ling', email: 'wong@hardwarehub.my', phone: '+604-880 2200', company: 'Hardware Hub Penang', status: 'active', lifecycleStage: 'opportunity', leadSource: 'Trade Show', tags: ['Prospect', 'Penang'] },
  ]
  for (const c of globexCustomers) {
    await prisma.customer.create({
      data: { tenantId: 'globex', ...c, tags: c.tags ? JSON.stringify(c.tags) : null, nationality: 'Malaysian', idType: 'IC', idNumber: null, dateOfBirth: null, gender: null, occupation: null }
    })
  }
  log(`  ✓ Created ${globexCustomers.length} customers (retailers, distributors, corporate buyers)`)

  // Suppliers — manufacturers
  const globexSuppliers = [
    { name: 'Shenzhen Electronics Co Ltd', contactName: 'Wei Zhang', email: 'wei@szelec.cn', phone: '+86-755-8812 3456', country: 'China', rating: 5 },
    { name: 'Osaka Industrial Supply', contactName: 'Takeshi Yamamoto', email: 'yamamoto@osaka-supply.jp', phone: '+81-6-6789 0123', country: 'Japan', rating: 4 },
    { name: 'Taiwan Precision Manufacturing', contactName: 'Chen Hui', email: 'chen@tpm.tw', phone: '+886-2-2755 6789', country: 'Taiwan', rating: 4 },
    { name: 'Klang Valley Distributors', contactName: 'Tan Boon Hui', email: 'tan@kvd.my', phone: '+603-3000 1234', country: 'Malaysia', rating: 3 },
  ]
  for (const s of globexSuppliers) {
    await prisma.supplier.create({ data: { tenantId: 'globex', ...s } })
  }
  log(`  ✓ Created ${globexSuppliers.length} suppliers (China, Japan, Taiwan, Malaysia)`)

  // Apply Trading preset for encounter template
  const tradingSections = [
    { id: 'order_specs', label: 'Order Specifications', type: 'textarea', showOnInvoice: true, halfWidth: false },
    { id: 'quality_notes', label: 'Quality Notes', type: 'textarea', showOnInvoice: true, halfWidth: false },
    { id: 'shipping_instructions', label: 'Shipping Instructions', type: 'textarea', showOnInvoice: true, halfWidth: false },
  ]
  const tradingTables = [{
    id: 'spec_lines', label: 'Spec Lines', showOnInvoice: true,
    columns: [
      { id: 'item', label: 'Item', type: 'product' },
      { id: 'spec', label: 'Specification', type: 'text' },
      { id: 'qty', label: 'Qty', type: 'number' },
      { id: 'unit', label: 'Unit', type: 'text' },
      { id: 'notes', label: 'Notes', type: 'text' },
    ],
  }]
  await prisma.encounterTemplate.upsert({
    where: { tenantId: 'globex' },
    create: {
      tenantId: 'globex', displayName: 'Order Specification',
      sections: JSON.stringify(tradingSections), itemTables: JSON.stringify(tradingTables),
      showAdvice: true, adviceLabel: 'Special Instructions', showFollowUp: true, followUpLabel: 'Delivery',
      showOnInvoice: true,
    },
    update: {
      displayName: 'Order Specification',
      sections: JSON.stringify(tradingSections), itemTables: JSON.stringify(tradingTables),
      showAdvice: true, adviceLabel: 'Special Instructions', showFollowUp: true, followUpLabel: 'Delivery',
      showOnInvoice: true,
    },
  })
  log('  ✓ Applied Trading preset (Order Specs / Quality Notes / Shipping Instructions)')

  // Create a few sample orders
  const gCustomers = await prisma.customer.findMany({ where: { tenantId: 'globex' } })
  const gProducts = await prisma.product.findMany({ where: { tenantId: 'globex', productType: 'physical' } })
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered']
  for (let i = 0; i < 8; i++) {
    const cust = gCustomers[i % gCustomers.length]
    const p1 = gProducts[i % gProducts.length]
    const p2 = gProducts[(i + 3) % gProducts.length]
    const qty1 = 50 + Math.floor(Math.random() * 200)
    const qty2 = 20 + Math.floor(Math.random() * 100)
    const total = qty1 * p1.price + qty2 * p2.price
    const orderNumber = `SO-${String(2024000 + i + 1)}`
    const status = statuses[i % statuses.length]
    const paidAmount = status === 'delivered' ? total : status === 'shipped' ? total * 0.5 : 0
    await prisma.salesOrder.create({
      data: {
        tenantId: 'globex', orderNumber, customerId: cust.id, status, total, paidAmount, currency: 'USD',
        items: {
          create: [
            { productId: p1.id, qty: qty1, unitPrice: p1.price },
            { productId: p2.id, qty: qty2, unitPrice: p2.price },
          ],
        },
      },
    })
  }
  log('  ✓ Created 8 sample wholesale orders')

  // Create a sample PO
  const gSupplier = await prisma.supplier.findFirst({ where: { tenantId: 'globex' } })
  if (gSupplier) {
    const poProduct = gProducts[0]
    await prisma.purchaseOrder.create({
      data: {
        tenantId: 'globex', poNumber: 'PO-2024001', supplierId: gSupplier.id,
        status: 'sent', total: 1000 * poProduct.cost,
        items: { create: [{ productId: poProduct.id, qty: 1000, unitCost: poProduct.cost }] },
      },
    })
    log('  ✓ Created 1 purchase order (restocking from Shenzhen Electronics)')
  }

  // ═══════════════════════════════════════════════════════════
  //  STARK → HEALTHPRIME CLINIC (Medical Clinic #2)
  // ═══════════════════════════════════════════════════════════
  section('TRANSFORM 2: Stark Industries → HealthPrime Clinic')
  await clearTenantData('stark')

  // Update tenant
  await prisma.tenant.update({
    where: { id: 'stark' },
    data: { name: 'HealthPrime Clinic', industry: 'Medical Clinic', plan: 'starter' },
  })
  log('  ✓ Tenant renamed: HealthPrime Clinic (Medical Clinic, Starter)')

  // Seed currency + set MYR as base
  await seedCurrencies('stark')
  await prisma.currency.updateMany({ where: { tenantId: 'stark' }, data: { isBase: false } })
  await prisma.currency.updateMany({ where: { tenantId: 'stark', code: 'MYR' }, data: { isBase: true } })
  log('  ✓ Base currency: MYR')

  // Products — different medications from DR HOUZE (proves isolation)
  const healthPrimeProducts = [
    // Services
    { name: 'General Consultation', sku: 'HP-CONS', category: 'Medication', price: 60, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Specialist Consultation', sku: 'HP-CONS-SP', category: 'Medication', price: 180, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Blood Test (Full Panel)', sku: 'HP-BLOOD', category: 'Medication', price: 150, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'X-Ray', sku: 'HP-XRAY', category: 'Medication', price: 120, cost: 0, stockQty: 0, productType: 'service' },
    { name: 'Ultrasound', sku: 'HP-US', category: 'Medication', price: 250, cost: 0, stockQty: 0, productType: 'service' },
    // Medications — different from DR HOUZE
    { name: 'Diclofenac 50mg', sku: 'HP-DICLO-50', category: 'Medication', price: 12.00, cost: 4.00, stockQty: 500, packSize: 10, packUnit: 'strip', baseUnit: 'tab' },
    { name: 'Omeprazole 20mg', sku: 'HP-OME-20', category: 'Medication', price: 15.00, cost: 5.00, stockQty: 300, packSize: 14, packUnit: 'strip', baseUnit: 'cap' },
    { name: 'Loratadine 10mg', sku: 'HP-LORA-10', category: 'Medication', price: 8.00, cost: 2.50, stockQty: 400, packSize: 10, packUnit: 'strip', baseUnit: 'tab' },
    { name: 'Ranitidine 150mg', sku: 'HP-RANI-150', category: 'Medication', price: 10.00, cost: 3.00, stockQty: 350, packSize: 10, packUnit: 'strip', baseUnit: 'tab' },
    { name: 'Metronidazole 400mg', sku: 'HP-METRO-400', category: 'Medication', price: 14.00, cost: 4.50, stockQty: 250, packSize: 14, packUnit: 'strip', baseUnit: 'tab' },
    { name: 'Vitamin C 1000mg', sku: 'HP-VITC-1000', category: 'Medication', price: 18.00, cost: 6.00, stockQty: 600, packSize: 30, packUnit: 'bottle', baseUnit: 'tab' },
    { name: 'Cough Syrup 100mL', sku: 'HP-COUGH-100', category: 'Medication', price: 22.00, cost: 8.00, stockQty: 150, packSize: 1, packUnit: 'bottle', baseUnit: 'bottle' },
    { name: 'Antiseptic Cream 30g', sku: 'HP-ANTISEP-30', category: 'Medication', price: 16.00, cost: 5.00, stockQty: 200, packSize: 1, packUnit: 'tube', baseUnit: 'tube' },
    { name: 'Medical Mask (Box of 50)', sku: 'HP-MASK-50', category: 'Medication', price: 25.00, cost: 10.00, stockQty: 100, packSize: 50, packUnit: 'box', baseUnit: 'pc' },
  ]
  for (const p of healthPrimeProducts) {
    await prisma.product.create({
      data: {
        tenantId: 'stark',
        name: p.name, sku: p.sku, category: p.category,
        price: p.price, cost: p.cost, stockQty: p.stockQty,
        reorderLevel: 50, warehouse: 'WH-Central',
        productType: (p as any).productType || 'physical',
        packSize: (p as any).packSize || null,
        packUnit: (p as any).packUnit || null,
        baseUnit: (p as any).baseUnit || null,
      },
    })
  }
  log(`  ✓ Created ${healthPrimeProducts.length} products (different medications from DR HOUZE)`)

  // Apply Medical Product custom field preset
  const hpFieldDefs = [
    { fieldKey: 'route', label: 'Route of Administration', type: 'select', options: ['Oral (PO)', 'Intravenous (IV)', 'Intramuscular (IM)', 'Topical', 'Inhaled', 'Sublingual (SL)', 'Ophthalmic (eye)', 'Nasal'] },
    { fieldKey: 'dosage_form', label: 'Dosage Form', type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Inhaler', 'Drops'] },
    { fieldKey: 'strength', label: 'Strength', type: 'text' },
    { fieldKey: 'packaging', label: 'Packaging', type: 'text' },
  ]
  for (const def of hpFieldDefs) {
    const existing = await prisma.customField.findFirst({ where: { tenantId: 'stark', module: 'products', fieldKey: def.fieldKey } })
    if (existing) continue
    await prisma.customField.create({
      data: {
        tenantId: 'stark', module: 'products', fieldKey: def.fieldKey, label: def.label, type: def.type,
        options: def.type === 'select' ? JSON.stringify(def.options) : null,
        isRequired: false, showInTable: def.fieldKey === 'strength', showInForm: true, isActive: true,
      },
    })
  }
  log('  ✓ Applied Medical Product custom field preset (route, dosage form, strength, packaging)')

  // Set clinical custom field values for each medication
  const hpMeds = await prisma.product.findMany({ where: { tenantId: 'stark', productType: 'physical' } })
  const hpClinicalData: Record<string, Record<string, string>> = {
    'HP-DICLO-50': { route: 'Oral (PO)', dosage_form: 'Tablet', strength: '50mg', packaging: '10 tabs / strip' },
    'HP-OME-20': { route: 'Oral (PO)', dosage_form: 'Capsule', strength: '20mg', packaging: '14 caps / strip' },
    'HP-LORA-10': { route: 'Oral (PO)', dosage_form: 'Tablet', strength: '10mg', packaging: '10 tabs / strip' },
    'HP-RANI-150': { route: 'Oral (PO)', dosage_form: 'Tablet', strength: '150mg', packaging: '10 tabs / strip' },
    'HP-METRO-400': { route: 'Oral (PO)', dosage_form: 'Tablet', strength: '400mg', packaging: '14 tabs / strip' },
    'HP-VITC-1000': { route: 'Oral (PO)', dosage_form: 'Tablet', strength: '1000mg', packaging: '30 tabs / bottle' },
    'HP-COUGH-100': { route: 'Oral (PO)', dosage_form: 'Syrup', strength: '100mL', packaging: '1 bottle / 100mL' },
    'HP-ANTISEP-30': { route: 'Topical', dosage_form: 'Cream', strength: '30g', packaging: '1 tube / 30g' },
    'HP-MASK-50': { route: '', dosage_form: '', strength: '', packaging: '50 pcs / box' },
  }
  for (const med of hpMeds) {
    const clinical = hpClinicalData[med.sku]
    if (!clinical) continue
    for (const [key, value] of Object.entries(clinical)) {
      if (!value) continue
      const cf = await prisma.customField.findFirst({ where: { tenantId: 'stark', module: 'products', fieldKey: key } })
      if (!cf) continue
      await prisma.customFieldValue.create({
        data: { tenantId: 'stark', customFieldId: cf.id, entityType: 'products', entityId: med.id, value },
      })
    }
  }
  log('  ✓ Set clinical custom field values for all medications')

  // Create patient custom fields
  const hpPatientFields = [
    { fieldKey: 'allergies', label: 'Allergies', type: 'textarea' },
    { fieldKey: 'medical_history', label: 'Medical History', type: 'textarea' },
    { fieldKey: 'current_medications', label: 'Current Medications', type: 'textarea' },
    { fieldKey: 'surgical_history', label: 'Surgical History', type: 'textarea' },
  ]
  for (const f of hpPatientFields) {
    const existing = await prisma.customField.findFirst({ where: { tenantId: 'stark', module: 'customers', fieldKey: f.fieldKey } })
    if (existing) continue
    await prisma.customField.create({
      data: { tenantId: 'stark', module: 'customers', fieldKey: f.fieldKey, label: f.label, type: f.type, isRequired: false, showInTable: false, showInForm: true, isActive: true },
    })
  }
  log('  ✓ Created patient custom fields (allergies, history, meds, surgical)')

  // Patients — different people from DR HOUZE (proves isolation)
  const hpPatients = [
    { name: 'Nurul Huda binti Hassan', email: 'nurul.huda@email.com', phone: '+6012-111 2222', company: 'Self-Pay Patient', status: 'active', dateOfBirth: new Date('1995-06-20'), gender: 'Female', idType: 'IC', idNumber: '950620-10-3333', nationality: 'Malaysian', occupation: 'Teacher', lifecycleStage: 'customer', leadSource: 'Walk-in', tags: ['Chronic'] },
    { name: 'David Wong', email: 'david.wong@email.com', phone: '+6016-555 6677', company: 'Self-Pay Patient', status: 'active', dateOfBirth: new Date('1982-11-05'), gender: 'Male', idType: 'IC', idNumber: '821105-08-7777', nationality: 'Malaysian', occupation: 'Accountant', lifecycleStage: 'customer', leadSource: 'Referral', tags: ['VIP'] },
    { name: 'Fatimah binti Abdullah', email: 'fatimah.abdullah@email.com', phone: '+6019-333 4455', company: 'Self-Pay Patient', status: 'active', dateOfBirth: new Date('1970-03-15'), gender: 'Female', idType: 'IC', idNumber: '700315-04-2222', nationality: 'Malaysian', occupation: 'Retired', lifecycleStage: 'customer', leadSource: 'Walk-in', tags: ['Senior', 'Hypertension'] },
    { name: 'Michael Tan', email: 'michael.tan@email.com', phone: '+6011-777 8899', company: 'Self-Pay Patient', status: 'lead', dateOfBirth: new Date('1988-09-10'), gender: 'Male', idType: 'Passport', idNumber: 'K12345678', nationality: 'Singaporean', occupation: 'Engineer', lifecycleStage: 'lead', leadSource: 'Website', tags: ['Foreigner', 'New'] },
    { name: 'Aishah binti Yusof', email: 'aishah.yusof@email.com', phone: '+6013-222 1100', company: 'Self-Pay Patient', status: 'active', dateOfBirth: new Date('1998-12-01'), gender: 'Female', idType: 'IC', idNumber: '981201-14-5555', nationality: 'Malaysian', occupation: 'Student', lifecycleStage: 'customer', leadSource: 'Walk-in', tags: ['Young Adult'] },
  ]
  for (const p of hpPatients) {
    await prisma.customer.create({
      data: { tenantId: 'stark', ...p, tags: p.tags ? JSON.stringify(p.tags) : null }
    })
  }
  log(`  ✓ Created ${hpPatients.length} patients (different from DR HOUZE's patients)`)

  // Suppliers
  const hpSuppliers = [
    { name: 'Pharmaniaga Logistics Sdn Bhd', contactName: 'Sales Rep', email: 'orders@pharmaniaga.com', phone: '03-5513 2000', country: 'Malaysia', rating: 5 },
    { name: 'DKSH Healthcare Malaysia', contactName: 'Account Manager', email: 'healthcare@dksh.com', phone: '03-7960 8000', country: 'Malaysia', rating: 4 },
  ]
  for (const s of hpSuppliers) {
    await prisma.supplier.create({ data: { tenantId: 'stark', ...s } })
  }
  log(`  ✓ Created ${hpSuppliers.length} suppliers`)

  // Apply Medical preset for encounter template
  const medicalSections = [
    { id: 'chief_complaints', label: 'Chief Complaints', type: 'textarea', showOnInvoice: true, halfWidth: false },
    { id: 'findings', label: 'Examination Findings', type: 'textarea', showOnInvoice: true, halfWidth: false },
    { id: 'diagnosis', label: 'Diagnosis', type: 'textarea', showOnInvoice: true, halfWidth: false },
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
  await prisma.encounterTemplate.upsert({
    where: { tenantId: 'stark' },
    create: {
      tenantId: 'stark', displayName: 'Clinical Visit',
      sections: JSON.stringify(medicalSections), itemTables: JSON.stringify(medicalTables),
      showAdvice: true, adviceLabel: 'Advice / Instructions', showFollowUp: true, followUpLabel: 'Follow-up',
      showOnInvoice: true, requireEncounterBeforeInvoice: false,
    },
    update: {
      displayName: 'Clinical Visit',
      sections: JSON.stringify(medicalSections), itemTables: JSON.stringify(medicalTables),
      showAdvice: true, adviceLabel: 'Advice / Instructions', showFollowUp: true, followUpLabel: 'Follow-up',
      showOnInvoice: true,
    },
  })
  log('  ✓ Applied Medical preset (Chief Complaints / Findings / Diagnosis + Rx Prescription)')

  // Create a few sample orders + encounters
  const hpCusts = await prisma.customer.findMany({ where: { tenantId: 'stark' } })
  const hpCons = await prisma.product.findFirst({ where: { tenantId: 'stark', sku: 'HP-CONS' } })
  const hpDoctor = await prisma.user.findFirst({ where: { tenantId: 'stark' } })
  for (let i = 0; i < 4; i++) {
    const cust = hpCusts[i % hpCusts.length]
    const total = 60 + (i % 3) * 30
    const status = i < 2 ? 'delivered' : 'pending'
    const paidAmount = status === 'delivered' ? total : 0
    const orderNumber = `HP-${String(1000 + i + 1)}`
    const order = await prisma.salesOrder.create({
      data: {
        tenantId: 'stark', orderNumber, customerId: cust.id, status, total, paidAmount, currency: 'MYR',
        items: { create: [{ productId: hpCons!.id, qty: 1, unitPrice: 60 }] },
      },
    })
    // Add encounter for first 2 orders
    if (i < 2) {
      const med = hpMeds[i % hpMeds.length]
      await prisma.clinicalEncounter.create({
        data: {
          tenantId: 'stark', orderId: order.id, patientId: cust.id,
          doctorId: hpDoctor?.id, doctorName: hpDoctor?.name || 'Doctor',
          data: JSON.stringify({
            sections: {
              chief_complaints: i === 0 ? 'Persistent cough and sore throat for 5 days.' : 'Stomach pain and acid reflux, worse after meals.',
              findings: i === 0 ? 'T 37.2°C, BP 110/70. Throat mildly red. Lungs clear.' : 'T 36.8°C, BP 125/80. Abdomen soft, mild epigastric tenderness.',
              diagnosis: i === 0 ? 'Upper respiratory tract infection with cough.' : 'Gastritis, likely H. pylori related.',
            },
            itemTables: {
              prescription: [{
                drug: med.id, dose: '1 tab', frequency: 'BD', duration: '5 days', instructions: 'After meals',
              }],
            },
          }),
          advice: i === 0 ? 'Drink warm water. Avoid cold drinks. Rest voice.' : 'Avoid spicy food. Eat smaller meals. Don\'t lie down right after eating.',
          followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          followUpNotes: 'Review in 5 days.',
        },
      })
    }
  }
  log('  ✓ Created 4 sample visits (2 with encounters)')

  // ═══════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════
  section('SUMMARY')
  const allTenants = await prisma.tenant.findMany({
    include: { _count: { select: { users: true, salesOrders: true, customers: true, products: true, suppliers: true } } },
  })
  for (const t of allTenants) {
    log(`\n  ${t.name} (${t.industry})`)
    log(`    plan=${t.plan}, users=${t._count.users}, orders=${t._count.salesOrders}, customers=${t._count.customers}, products=${t._count.products}, suppliers=${t._count.suppliers}`)
  }
  log('\n═══════════════════════════════════════════════════════════════')
  log('  ✅ DONE — 3 tenants with industry-specific demo data')
  log('═══════════════════════════════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
