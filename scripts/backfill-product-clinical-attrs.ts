// Backfill DR HOUZE products with clinical attributes
// (route, packaging, dosageForm, strength) based on their name/SKU.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

const ATTRIBUTES: Record<string, { route?: string; packaging?: string; dosageForm?: string; strength?: string }> = {
  'SRV-CONS':     { /* service */ },
  'SRV-CONS-SP':  { /* service */ },
  'SRV-IV':       { /* service */ },
  'SRV-WND':      { /* service */ },
  'SRV-ECG':      { /* service */ },
  'MED-PARA-500': { route: 'Oral (PO)', packaging: '10 tabs / strip', dosageForm: 'Tablet', strength: '500mg' },
  'MED-AMOX-500': { route: 'Oral (PO)', packaging: '10 caps / strip', dosageForm: 'Capsule', strength: '500mg' },
  'MED-MET-500':  { route: 'Oral (PO)', packaging: '30 tabs / bottle', dosageForm: 'Tablet', strength: '500mg' },
  'MED-AMLO-5':   { route: 'Oral (PO)', packaging: '30 tabs / bottle', dosageForm: 'Tablet', strength: '5mg' },
  'MED-ATOR-20':  { route: 'Oral (PO)', packaging: '30 tabs / bottle', dosageForm: 'Tablet', strength: '20mg' },
  'MED-SALB-INH': { route: 'Inhaled', packaging: '1 inhaler / 200 doses', dosageForm: 'Inhaler', strength: '100mcg/puff' },
  'MED-CET-10':   { route: 'Oral (PO)', packaging: '10 tabs / strip', dosageForm: 'Tablet', strength: '10mg' },
  'MED-OME-20':   { route: 'Oral (PO)', packaging: '14 caps / strip', dosageForm: 'Capsule', strength: '20mg' },
  'MED-ORS':      { route: 'Oral (PO)', packaging: '1 sachet / 5g (makes 200mL)', dosageForm: 'Powder', strength: 'Na+ 75mmol/L' },
}

async function main() {
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID } })
  console.log(`Found ${products.length} products to update`)

  let updated = 0
  for (const p of products) {
    const attrs = ATTRIBUTES[p.sku]
    if (!attrs) {
      console.log(`  ⏭️  ${p.sku} — no attributes defined (skipped)`)
      continue
    }
    await prisma.product.update({
      where: { id: p.id },
      data: {
        route: attrs.route || null,
        packaging: attrs.packaging || null,
        dosageForm: attrs.dosageForm || null,
        strength: attrs.strength || null,
      },
    })
    console.log(`  ✅ ${p.sku} (${p.name}) → ${[attrs.strength, attrs.dosageForm, attrs.route, attrs.packaging].filter(Boolean).join(' · ')}`)
    updated++
  }
  console.log(`\nDone. Updated ${updated}/${products.length} products with clinical attributes.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
