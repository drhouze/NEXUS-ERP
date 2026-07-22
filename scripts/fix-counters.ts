import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function fix() {
  const tenants = await db.tenant.findMany()
  for (const t of tenants) {
    // Count existing records and set counter accordingly
    const soCount = await db.salesOrder.count({ where: { tenantId: t.id } })
    const poCount = await db.purchaseOrder.count({ where: { tenantId: t.id } })
    const prodCount = await db.product.count({ where: { tenantId: t.id } })
    const custCount = await db.customer.count({ where: { tenantId: t.id } })
    const suppCount = await db.supplier.count({ where: { tenantId: t.id } })
    const empCount = await db.employee.count({ where: { tenantId: t.id } })
    const txnCount = await db.transaction.count({ where: { tenantId: t.id } })

    await db.tenantNumberSetting.upsert({
      where: { tenantId: t.id },
      create: {
        tenantId: t.id,
        salesOrderCounter: soCount,
        purchaseOrderCounter: poCount,
        productCounter: prodCount,
        customerCounter: custCount,
        supplierCounter: suppCount,
        employeeCounter: empCount,
        transactionCounter: txnCount,
      },
      update: {
        salesOrderCounter: soCount,
        purchaseOrderCounter: poCount,
        productCounter: prodCount,
        customerCounter: custCount,
        supplierCounter: suppCount,
        employeeCounter: empCount,
        transactionCounter: txnCount,
      },
    })

    console.log(`${t.name}: SO=${soCount}, PO=${poCount}, Prod=${prodCount}, Cust=${custCount}`)
  }
  await db.$disconnect()
}

fix().catch(console.error)
