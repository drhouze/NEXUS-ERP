// One-off script: reset medical-specific InvoiceTemplate defaults that leaked to non-medical tenants.
// Run once after the schema-default change.
// Idempotent — safe to re-run.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Reset InvoiceTemplate defaults that were medical-specific
  const invoiceResult = await prisma.invoiceTemplate.updateMany({
    data: {
      showClinicalNotes: false,
      showPatientIC: false,
      clinicName: '',
    },
  })
  console.log(`[InvoiceTemplate] Reset ${invoiceResult.count} row(s) → showClinicalNotes=false, showPatientIC=false, clinicName=''`)

  // 2. Reset EncounterTemplate.showAdvice / showFollowUp for empty (un-designed) templates
  //    so a fresh tenant doesn't see empty advice/follow-up blocks on their invoice.
  const encounterResult = await prisma.encounterTemplate.updateMany({
    where: {
      sections: '[]',
      itemTables: '[]',
    },
    data: {
      showAdvice: false,
      showFollowUp: false,
    },
  })
  console.log(`[EncounterTemplate] Reset ${encounterResult.count} empty template(s) → showAdvice=false, showFollowUp=false`)

  // 3. Summary
  const total = await prisma.invoiceTemplate.count()
  const withClinical = await prisma.invoiceTemplate.count({ where: { showClinicalNotes: true } })
  const withPatientIc = await prisma.invoiceTemplate.count({ where: { showPatientIC: true } })
  console.log(`\nFinal state:`)
  console.log(`  - InvoiceTemplate total: ${total}`)
  console.log(`  - With showClinicalNotes=true: ${withClinical}`)
  console.log(`  - With showPatientIC=true: ${withPatientIc}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
