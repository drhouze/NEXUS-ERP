// One-off: fix currency on Acme Corp orders from USD → MYR
// (the seed data set currency=USD but the tenant actually bills in RM)

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.salesOrder.updateMany({
    where: { tenantId: 'acme', currency: 'USD' },
    data: { currency: 'MYR' },
  })
  console.log(`Updated ${result.count} ACME orders: currency USD → MYR`)

  // Verify
  const remaining = await prisma.salesOrder.count({ where: { tenantId: 'acme', currency: 'USD' } })
  console.log(`Remaining ACME orders with currency=USD: ${remaining}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
