// Convert DR HOUZE's existing "Age" custom field from type=number to type=calculated
// (formulaType=age_from_ic, sourceField=ic_passport_number), then recompute the stored
// age values for all existing patients based on their IC numbers.

import { PrismaClient } from '@prisma/client'
import { computeCalculatedValue } from '../src/lib/calculated-fields'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

async function main() {
  // 1. Find the existing Age field
  const ageField = await prisma.customField.findFirst({
    where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'age' },
  })
  if (!ageField) {
    console.log('❌ Age field not found. Run setup-dr-houze-clinic.ts first.')
    process.exit(1)
  }
  console.log(`Found Age field: id=${ageField.id}, current type=${ageField.type}`)

  // 2. Convert it to a calculated field (age from IC)
  const updated = await prisma.customField.update({
    where: { id: ageField.id },
    data: {
      type: 'calculated',
      formulaType: 'age_from_ic',
      sourceField: 'ic_passport_number',
      // clear formula field (not used for calculated type)
      formula: null,
    },
  })
  console.log(`✅ Converted Age field → type=calculated, formulaType=age_from_ic, sourceField=ic_passport_number`)

  // 3. Recompute the stored age values for all DR HOUZE patients
  const allValues = await prisma.customFieldValue.findMany({
    where: { customFieldId: ageField.id },
    include: { customField: true },
  })
  console.log(`\nRecomputing ${allValues.length} age values...`)

  // Index IC values by entityId for quick lookup
  const icField = await prisma.customField.findFirst({
    where: { tenantId: TENANT_ID, module: 'customers', fieldKey: 'ic_passport_number' },
  })
  if (!icField) {
    console.log('❌ ic_passport_number field not found.')
    process.exit(1)
  }
  const icValues = await prisma.customFieldValue.findMany({
    where: { customFieldId: icField.id },
    select: { entityId: true, value: true },
  })
  const icByEntityId: Record<string, string> = {}
  for (const v of icValues) icByEntityId[v.entityId] = v.value || ''

  let updatedCount = 0
  for (const cv of allValues) {
    const ic = icByEntityId[cv.entityId] || ''
    const newAge = computeCalculatedValue('age_from_ic', ic)
    const oldAge = cv.value || ''
    if (newAge !== oldAge) {
      await prisma.customFieldValue.update({
        where: { id: cv.id },
        data: { value: newAge },
      })
      console.log(`  ✓ entity ${cv.entityId}: IC="${ic}" → age ${oldAge || '(empty)'} → ${newAge || '(empty)'}`)
      updatedCount++
    } else {
      console.log(`  = entity ${cv.entityId}: IC="${ic}" → age ${oldAge} (unchanged)`)
    }
  }
  console.log(`\n✅ Done. Recomputed ${updatedCount} of ${allValues.length} age values.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
