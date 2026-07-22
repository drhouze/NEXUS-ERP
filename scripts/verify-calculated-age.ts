// Verify the calculated age feature end-to-end for DR HOUZE
import { PrismaClient } from '@prisma/client'
import { computeCalculatedValue } from '../src/lib/calculated-fields'
const prisma = new PrismaClient()

async function main() {
  const ageField = await prisma.customField.findFirst({
    where: { tenantId: 'acme', module: 'customers', fieldKey: 'age' },
  })
  console.log('Age field config:')
  console.log('  type:', ageField?.type)
  console.log('  formulaType:', ageField?.formulaType)
  console.log('  sourceField:', ageField?.sourceField)
  console.log()

  const icField = await prisma.customField.findFirst({
    where: { tenantId: 'acme', module: 'customers', fieldKey: 'ic_passport_number' },
  })

  const patients = await prisma.customer.findMany({ where: { tenantId: 'acme' } })
  console.log('Patient ages (recomputed live from IC):')
  for (const p of patients) {
    const icVal = await prisma.customFieldValue.findFirst({
      where: { customFieldId: icField!.id, entityId: p.id },
    })
    const ic = icVal?.value || ''
    const liveAge = computeCalculatedValue('age_from_ic', ic)
    console.log(`  ${p.name.padEnd(30)} IC=${ic.padEnd(20)} → age ${liveAge}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
