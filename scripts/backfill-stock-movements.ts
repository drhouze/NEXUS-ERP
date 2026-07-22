// Backfill stock movements for existing PO receipts + order deliveries
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const tenants = await db.tenant.findMany()
  let totalCreated = 0

  for (const tenant of tenants) {
    console.log(`\nBackfilling stock movements for ${tenant.name}...`)

    // 1. Received POs → stock in movements
    const receivedPOs = await db.purchaseOrder.findMany({
      where: { tenantId: tenant.id, status: 'received' },
      include: { items: { include: { product: true } }, supplier: true },
    })

    let poCount = 0
    for (const po of receivedPOs) {
      for (const item of po.items) {
        // Check if movement already exists
        const existing = await db.stockMovement.findFirst({
          where: { tenantId: tenant.id, refType: 'purchase_order', refId: po.id, productId: item.productId },
        })
        if (existing) continue

        await db.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId: item.productId,
            warehouseId: item.product.warehouseId,
            type: 'in',
            quantity: item.qty,
            reason: 'received_po',
            refType: 'purchase_order',
            refId: po.id,
            notes: `Received via ${po.poNumber}`,
            createdAt: po.createdAt,
          },
        })
        totalCreated++
        poCount++
      }
    }
    console.log(`  ✓ Created ${poCount} PO stock movements`)

    // 2. Delivered/shipped orders → stock out movements
    const deliveredOrders = await db.salesOrder.findMany({
      where: { tenantId: tenant.id, status: { in: ['delivered', 'shipped'] } },
      include: { items: { include: { product: true } }, customer: true },
    })

    let orderCount = 0
    for (const order of deliveredOrders) {
      for (const item of order.items) {
        const existing = await db.stockMovement.findFirst({
          where: { tenantId: tenant.id, refType: 'sales_order', refId: order.id, productId: item.productId },
        })
        if (existing) continue

        await db.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId: item.productId,
            warehouseId: item.product.warehouseId,
            type: 'out',
            quantity: -item.qty,
            reason: 'sales_order',
            refType: 'sales_order',
            refId: order.id,
            notes: `Sold via ${order.orderNumber}`,
            createdAt: order.createdAt,
          },
        })
        totalCreated++
        orderCount++
      }
    }
    console.log(`  ✓ Created ${orderCount} order stock movements`)
  }

  console.log(`\n✅ Backfill complete! ${totalCreated} stock movements created.`)
  const total = await db.stockMovement.count()
  console.log(`Total stock movements in DB: ${total}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
