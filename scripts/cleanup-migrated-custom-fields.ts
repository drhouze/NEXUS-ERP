// Cleanup: delete the migrated custom fields (IC, age, gender) from DR HOUZE
// since they've been promoted to first-class Customer columns.
// Keep allergies, medical_history, current_medications, surgical_history as custom fields
// (those are tenant-defined and may vary per tenant).
//
// Also update the invoice template's patientCustomFields list to remove references
// to the migrated keys, so the invoice doesn't try to load non-existent custom field values.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'
const MIGRATED_KEYS = ['ic_passport_number', 'age', 'gender']  // promoted to first-class

async function main() {
  console.log('═══ Cleaning up migrated custom fields for DR HOUZE ═══\n')

  // 1. Find custom fields to delete
  const fields = await prisma.customField.findMany({
    where: { tenantId: TENANT_ID, module: 'customers', fieldKey: { in: MIGRATED_KEYS } },
  })
  console.log(`Found ${fields.length} migrated custom fields to delete:`)
  for (const f of fields) console.log(`  • ${f.label} (${f.fieldKey}, type=${f.type})`)

  // 2. Delete their stored values first (FK constraint)
  for (const f of fields) {
    const result = await prisma.customFieldValue.deleteMany({ where: { customFieldId: f.id } })
    console.log(`  ✓ Deleted ${result.count} stored value(s) for ${f.fieldKey}`)
  }

  // 3. Delete the field definitions
  for (const f of fields) {
    await prisma.customField.delete({ where: { id: f.id } })
    console.log(`  ✓ Deleted field definition: ${f.fieldKey}`)
  }

  // 4. Update invoice template's patientCustomFields list to remove the migrated keys
  const tmpl = await prisma.invoiceTemplate.findUnique({ where: { tenantId: TENANT_ID } })
  if (tmpl?.patientCustomFields) {
    let arr: string[] = []
    try { arr = JSON.parse(tmpl.patientCustomFields) || [] } catch { arr = [] }
    const filtered = arr.filter(k => !MIGRATED_KEYS.includes(k))
    await prisma.invoiceTemplate.update({
      where: { tenantId: TENANT_ID },
      data: { patientCustomFields: JSON.stringify(filtered) },
    })
    console.log(`\n✓ Updated invoice template patientCustomFields: ${arr.length} → ${filtered.length} (removed ${MIGRATED_KEYS.join(', ')})`)
  }

  // 5. Show what's left
  const remaining = await prisma.customField.findMany({
    where: { tenantId: TENANT_ID, module: 'customers' },
    select: { fieldKey: true, label: true, type: true },
  })
  console.log(`\nRemaining customer custom fields (${remaining.length}):`)
  for (const f of remaining) console.log(`  • ${f.label} (${f.fieldKey}, type=${f.type})`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
