// Reset Acme's encounter template back to blank — the Trading preset was auto-applied
// by an over-eager test script. Tenants should design their own form or pick a preset
// from the UI (Settings → Service Form Designer). Also clear the encounter data on
// any orders that were filled in with Trading-preset-shaped values, so the invoice
// doesn't show mismatched sections.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Reset Acme's encounter template to blank
  const reset = await prisma.encounterTemplate.upsert({
    where: { tenantId: 'acme' },
    create: {
      tenantId: 'acme',
      displayName: 'Service Form',
      sections: '[]',
      itemTables: '[]',
      showAdvice: false,
      adviceLabel: 'Notes',
      showFollowUp: false,
      followUpLabel: 'Follow-up',
      showOnInvoice: true,
    },
    update: {
      displayName: 'Service Form',
      sections: '[]',
      itemTables: '[]',
      showAdvice: false,
      adviceLabel: 'Notes',
      showFollowUp: false,
      followUpLabel: 'Follow-up',
    },
  })
  console.log(`✅ Reset Acme encounter template → blank "Service Form"`)

  // 2. Delete encounters that have Trading-preset-shaped data on Acme orders
  //    (these were created by the e2e test script — they reference sections/tables
  //    that no longer exist in the now-blank template)
  const encounters = await prisma.clinicalEncounter.findMany({
    where: { tenantId: 'acme' },
    select: { id: true, orderId: true, data: true },
  })
  let deleted = 0
  for (const e of encounters) {
    // If the encounter's data has sections like "order_specs" / "quality_notes" / "shipping_instructions"
    // (Trading preset keys), it's stale — delete it so the invoice doesn't show mismatched content.
    let data: any = {}
    try { data = JSON.parse(e.data || '{}') } catch { /* */ }
    const sectionKeys = Object.keys(data.sections || {})
    const isStale = sectionKeys.some(k =>
      k === 'order_specs' || k === 'quality_notes' || k === 'shipping_instructions'
    )
    if (isStale) {
      await prisma.clinicalEncounter.delete({ where: { id: e.id } })
      deleted++
      console.log(`   • Deleted stale encounter ${e.id} (order ${e.orderId})`)
    }
  }
  console.log(`✅ Deleted ${deleted} stale encounter(s) on Acme orders`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
