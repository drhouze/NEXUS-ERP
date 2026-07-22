// Backfill DR HOUZE products with structured pack-size info (packSize, packUnit, baseUnit)
// based on their SKU / name. Also adjusts `price` to be the per-pack price where it makes sense.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TENANT_ID = 'acme'

const PACK_INFO: Record<string, { packSize: number; packUnit: string; baseUnit: string }> = {
  'MED-PARA-500': { packSize: 10, packUnit: 'strip', baseUnit: 'tab' },
  'MED-AMOX-500': { packSize: 10, packUnit: 'strip', baseUnit: 'cap' },
  'MED-MET-500':  { packSize: 30, packUnit: 'bottle', baseUnit: 'tab' },
  'MED-AMLO-5':   { packSize: 30, packUnit: 'bottle', baseUnit: 'tab' },
  'MED-ATOR-20':  { packSize: 30, packUnit: 'bottle', baseUnit: 'tab' },
  'MED-SALB-INH': { packSize: 200, packUnit: 'inhaler', baseUnit: 'puff' },
  'MED-CET-10':   { packSize: 10, packUnit: 'strip', baseUnit: 'tab' },
  'MED-OME-20':   { packSize: 14, packUnit: 'strip', baseUnit: 'cap' },
  'MED-ORS':      { packSize: 1, packUnit: 'sachet', baseUnit: 'sachet' },
}

async function main() {
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID } })
  console.log(`Found ${products.length} products to update\n`)

  let updated = 0
  for (const p of products) {
    const info = PACK_INFO[p.sku]
    if (!info) {
      console.log(`  ⏭️  ${p.sku} (${p.name}) — no pack info defined (service or untracked)`)
      continue
    }
    await prisma.product.update({
      where: { id: p.id },
      data: {
        packSize: info.packSize,
        packUnit: info.packUnit,
        baseUnit: info.baseUnit,
      },
    })
    console.log(`  ✅ ${p.sku} (${p.name})`)
    console.log(`     packSize=${info.packSize}, packUnit=${info.packUnit}, baseUnit=${info.baseUnit}`)
    console.log(`     e.g., doctor prescribes 5 ${info.baseUnit} → dispense 1 ${info.packUnit} of ${info.packSize}`)
    updated++
  }
  console.log(`\nDone. Updated ${updated}/${products.length} products with structured pack info.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
