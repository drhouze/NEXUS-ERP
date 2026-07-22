// Migration: move DR HOUZE's customer custom field values (IC, age, gender)
// into the new first-class Customer columns (idType, idNumber, gender, dateOfBirth).
// Also populate lifecycleStage from the legacy 'status' field.
// After migration, the user can safely delete the IC/Age/Gender custom fields
// (we keep them by default — run scripts/cleanup-migrated-custom-fields.ts to delete).

import { PrismaClient } from '@prisma/client'
import { parseIcToBirthDate, parseIcToGender } from '../src/lib/calculated-fields'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

async function main() {
  console.log('═══ Migrating DR HOUZE customer custom fields → first-class columns ═══\n')

  const customers = await prisma.customer.findMany({ where: { tenantId: TENANT_ID } })
  console.log(`Found ${customers.length} customers\n`)

  // Get the custom field definitions to find IDs
  const customFields = await prisma.customField.findMany({
    where: { tenantId: TENANT_ID, module: 'customers' },
  })
  const fieldByKey: Record<string, string> = {}
  for (const f of customFields) fieldByKey[f.fieldKey] = f.id

  let migrated = 0
  let skipped = 0

  for (const c of customers) {
    const updates: any = {}

    // Read custom field values for this customer
    const values = await prisma.customFieldValue.findMany({
      where: { entityType: 'customers', entityId: c.id },
      include: { customField: true },
    })
    const valueByKey: Record<string, string> = {}
    for (const v of values) valueByKey[v.customField.fieldKey] = v.value || ''

    // IC / Passport number → idType + idNumber + dateOfBirth (parsed from IC)
    const icValue = valueByKey['ic_passport_number']
    if (icValue && !c.idNumber) {
      // Detect if it's an IC (12 digits) or passport (alphanumeric)
      const digits = icValue.replace(/\D/g, '')
      const isIc = digits.length === 12
      updates.idType = isIc ? 'IC' : 'Passport'
      updates.idNumber = icValue
      // Try to parse DOB from IC
      if (isIc && !c.dateOfBirth) {
        const dob = parseIcToBirthDate(icValue)
        if (dob) updates.dateOfBirth = dob
      }
    }

    // Gender (custom select) → gender column
    const genderValue = valueByKey['gender']
    if (genderValue && !c.gender) {
      updates.gender = genderValue
    } else if (!genderValue && c.idNumber && (!c.idType || c.idType === 'IC') && !c.gender) {
      // Try to derive gender from IC last digit if not already set
      const g = parseIcToGender(c.idNumber)
      if (g) updates.gender = g
    }

    // Lifecycle stage: derive from existing 'status' field if not set
    if (!c.lifecycleStage) {
      if (c.status === 'active') updates.lifecycleStage = 'customer'
      else if (c.status === 'inactive') updates.lifecycleStage = 'churned'
      else updates.lifecycleStage = 'lead'
    }

    // Lead source: default to Walk-in for DR HOUZE (clinic patients typically walk in)
    if (!c.leadSource) {
      updates.leadSource = 'Walk-in'
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  = ${c.name}: nothing to migrate`)
      skipped++
      continue
    }

    await prisma.customer.update({ where: { id: c.id }, data: updates })
    const summary = Object.keys(updates).join(', ')
    console.log(`  ✓ ${c.name}: ${summary}`)
    migrated++
  }

  console.log(`\n✅ Migration done. ${migrated} customers updated, ${skipped} skipped.`)

  // Verify: show the migrated state for the first few customers
  console.log('\n═══ Verification (first 5 customers) ═══')
  const verified = await prisma.customer.findMany({ where: { tenantId: TENANT_ID }, take: 5 })
  for (const c of verified) {
    console.log(`\n  ${c.name}:`)
    console.log(`    idType=${c.idType}, idNumber=${c.idNumber}`)
    console.log(`    dateOfBirth=${c.dateOfBirth?.toISOString().slice(0, 10) || '—'}`)
    console.log(`    gender=${c.gender || '—'}`)
    console.log(`    lifecycleStage=${c.lifecycleStage}, leadSource=${c.leadSource}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
