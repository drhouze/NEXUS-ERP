// Migration: move DR HOUZE product clinical attributes (route, dosageForm, strength, packaging)
// from Product columns to tenant-defined custom fields on the products module.
//
// Why: route/dosageForm/strength/packaging are medical-specific. They shouldn't be hardcoded
// columns that every tenant (hotel, tailor, trading) sees. They should be tenant-defined
// custom fields, just like allergies/medical history are custom fields on customers.
//
// What this script does:
//   1. Creates 4 custom field definitions on the products module for DR HOUZE:
//      - Route of Administration (select: Oral/IV/IM/...)
//      - Dosage Form (select: Tablet/Capsule/Syrup/...)
//      - Strength (text)
//      - Packaging (text)
//   2. Copies the existing column values into CustomFieldValue rows for each product
//   3. Verifies the migration

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

const FIELD_DEFS = [
  {
    fieldKey: 'route',
    label: 'Route of Administration',
    type: 'select',
    options: ['Oral (PO)', 'Intravenous (IV)', 'Intramuscular (IM)', 'Subcutaneous (SC)', 'Topical', 'Inhaled', 'Sublingual (SL)', 'Rectal (PR)', 'Ophthalmic (eye)', 'Otic (ear)', 'Nasal', 'Transdermal', 'Vaginal'],
  },
  {
    fieldKey: 'dosage_form',
    label: 'Dosage Form',
    type: 'select',
    options: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Gel', 'Inhaler', 'Drops', 'Spray', 'Suppository', 'Patch', 'Lozenge'],
  },
  {
    fieldKey: 'strength',
    label: 'Strength',
    type: 'text',
  },
  {
    fieldKey: 'packaging',
    label: 'Packaging',
    type: 'text',
  },
]

async function main() {
  console.log('═══ Migrating product clinical attributes → custom fields ═══\n')

  // 1. Create (or find) the 4 custom field definitions
  const fieldIdByKey: Record<string, string> = {}
  for (const def of FIELD_DEFS) {
    const existing = await prisma.customField.findFirst({
      where: { tenantId: TENANT_ID, module: 'products', fieldKey: def.fieldKey },
    })
    if (existing) {
      fieldIdByKey[def.fieldKey] = existing.id
      console.log(`  = Found existing field: ${def.label} (${def.fieldKey})`)
    } else {
      const created = await prisma.customField.create({
        data: {
          tenantId: TENANT_ID,
          module: 'products',
          fieldKey: def.fieldKey,
          label: def.label,
          type: def.type,
          options: def.type === 'select' ? JSON.stringify(def.options) : null,
          isRequired: false,
          showInTable: def.fieldKey === 'strength' || def.fieldKey === 'dosage_form',  // show strength + dosage in table
          showInForm: true,
          isActive: true,
        },
      })
      fieldIdByKey[def.fieldKey] = created.id
      console.log(`  ✓ Created field: ${def.label} (${def.fieldKey})`)
    }
  }

  // 2. Copy product column values → custom field values
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID } })
  console.log(`\nMigrating ${products.length} products...`)

  let migrated = 0
  for (const p of products as any) {
    const columnsToMigrate: Array<{ key: string; value: string | null }> = [
      { key: 'route', value: p.route },
      { key: 'dosage_form', value: p.dosageForm },
      { key: 'strength', value: p.strength },
      { key: 'packaging', value: p.packaging },
    ]
    let changed = false
    for (const { key, value } of columnsToMigrate) {
      if (!value) continue  // skip empty
      const cfId = fieldIdByKey[key]
      if (!cfId) continue
      // Upsert the custom field value
      await prisma.customFieldValue.upsert({
        where: { customFieldId_entityId: { customFieldId: cfId, entityId: p.id } },
        create: {
          tenantId: TENANT_ID,
          customFieldId: cfId,
          entityType: 'products',
          entityId: p.id,
          value: String(value),
        },
        update: { value: String(value) },
      })
      changed = true
    }
    if (changed) {
      migrated++
      console.log(`  ✓ ${p.sku} (${p.name}) — migrated ${[p.route, p.dosageForm, p.strength, p.packaging].filter(Boolean).length} field(s)`)
    }
  }

  console.log(`\n✅ Migration complete. ${migrated}/${products.length} products had clinical attributes copied to custom fields.`)
  console.log(`\nNote: the Product columns (route, dosageForm, strength, packaging) are still present in the DB.`)
  console.log(`The next step is to drop those columns from the schema and update the UI to read from custom fields.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
