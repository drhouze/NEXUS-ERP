// Audit all tenants + their encounter templates + invoice templates.
// Find any tenant whose industry suggests medical/clinic but whose encounter template
// has Trading-preset sections like "Shipping Instructions".

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      encounterTemplate: true,
      invoiceTemplate: true,
      _count: { select: { salesOrders: true, users: true } },
    },
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${tenants.length} tenant(s)\n`)
  console.log('┌────────────────────────────────────────────────────────────────────────────────┐')
  for (const t of tenants) {
    console.log(`│ Tenant: "${t.name}"  (industry=${t.industry}, plan=${t.plan})`)
    console.log(`│   id=${t.id}, users=${t._count.users}, orders=${t._count.salesOrders}`)
    if (t.invoiceTemplate) {
      const it = t.invoiceTemplate
      console.log(`│ InvoiceTemplate:`)
      console.log(`│   clinicName="${it.clinicName}", currencySymbol="${it.currencySymbol}"`)
      console.log(`│   showClinicalNotes=${it.showClinicalNotes}, showPatientIC=${it.showPatientIC}`)
    } else {
      console.log(`│ InvoiceTemplate: (none — will use neutral defaults)`)
    }
    if (t.encounterTemplate) {
      const et = t.encounterTemplate
      const sections = JSON.parse(et.sections || '[]') as any[]
      const tables = JSON.parse(et.itemTables || '[]') as any[]
      console.log(`│ EncounterTemplate: displayName="${et.displayName}", showOnInvoice=${et.showOnInvoice}`)
      console.log(`│   sections (${sections.length}):`)
      sections.forEach(s => console.log(`│     - "${s.label}" (type=${s.type}, showOnInvoice=${s.showOnInvoice})`))
      console.log(`│   itemTables (${tables.length}):`)
      tables.forEach(tbl => console.log(`│     - "${tbl.label}" (${tbl.columns.length} cols)`))
      // Flag mismatches
      const industry = (t.industry || '').toLowerCase()
      const sectionLabels = sections.map(s => (s.label || '').toLowerCase()).join(' | ')
      const isMedicalTenant = industry.includes('medic') || industry.includes('clinic') || industry.includes('health') || industry.includes('doctor')
      const isHotelTenant = industry.includes('hotel') || industry.includes('hospitality')
      const isTailorTenant = industry.includes('tailor') || industry.includes('fashion') || industry.includes('garment')
      const hasShipping = sectionLabels.includes('shipping')
      const hasPrescription = sectionLabels.includes('drug') || sectionLabels.includes('dose')
      const hasMeasurements = sectionLabels.includes('measurement')
      const hasGuestPrefs = sectionLabels.includes('guest') || sectionLabels.includes('preference')
      const flags: string[] = []
      if (isMedicalTenant && hasShipping) flags.push('🚨 Medical tenant but has "Shipping Instructions" (Trading preset?)')
      if (isMedicalTenant && hasMeasurements) flags.push('🚨 Medical tenant but has "Measurements" (Tailor preset?)')
      if (isMedicalTenant && hasGuestPrefs) flags.push('🚨 Medical tenant but has Guest sections (Hotel preset?)')
      if (isHotelTenant && hasShipping) flags.push('🚨 Hotel tenant but has "Shipping Instructions"')
      if (isHotelTenant && hasPrescription) flags.push('🚨 Hotel tenant but has Prescription sections')
      if (isTailorTenant && hasShipping) flags.push('🚨 Tailor tenant but has "Shipping Instructions"')
      if (isTailorTenant && hasPrescription) flags.push('🚨 Tailor tenant but has Prescription sections')
      if (flags.length > 0) {
        console.log(`│ ⚠️  MISMATCH FLAGS:`)
        flags.forEach(f => console.log(`│   ${f}`))
      }
    } else {
      console.log(`│ EncounterTemplate: (none — Service Form will show "design your form" placeholder)`)
    }
    console.log('└────────────────────────────────────────────────────────────────────────────────┘')
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
