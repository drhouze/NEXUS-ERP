// Backfill journal entries for existing data
// Run with: bun run scripts/backfill-accounting.ts

import { PrismaClient } from '@prisma/client'
import { seedChartOfAccounts, postJournalEntry } from '../src/lib/accounting'

const db = new PrismaClient()

async function main() {
  const tenants = await db.tenant.findMany()

  for (const tenant of tenants) {
    console.log(`\nBackfilling accounting for ${tenant.name}...`)

    // 1. Seed chart of accounts
    await seedChartOfAccounts(tenant.id)
    console.log(`  ✓ Chart of accounts seeded`)

    // 2. Backfill sales order journal entries (delivered/shipped orders)
    const orders = await db.salesOrder.findMany({
      where: { tenantId: tenant.id, status: { in: ['delivered', 'shipped'] } },
      include: { items: { include: { product: true } }, customer: true, payments: true },
    })

    let orderCount = 0
    for (const order of orders) {
      // Skip if journal entry already exists for this order
      const existing = await db.journalEntry.findFirst({
        where: { tenantId: tenant.id, refType: 'sales_order', refId: order.id },
      })
      if (existing) continue

      try {
        // Revenue entry: Debit AR, Credit Revenue
        await postJournalEntry({
          tenantId: tenant.id,
          description: `Revenue for ${order.orderNumber} (${order.customer.company})`,
          refType: 'sales_order',
          refId: order.id,
          lines: [
            { accountCode: '1100', debit: order.total },
            { accountCode: '4000', credit: order.total },
          ],
        })

        // COGS entry: Debit COGS, Credit Inventory
        const cogs = order.items.reduce((s, item) => s + item.qty * item.product.cost, 0)
        if (cogs > 0) {
          await postJournalEntry({
            tenantId: tenant.id,
            description: `COGS for ${order.orderNumber}`,
            refType: 'sales_order',
            refId: order.id,
            lines: [
              { accountCode: '5000', debit: cogs },
              { accountCode: '1200', credit: cogs },
            ],
          })
        }

        // Payment entries: for each payment, Debit Cash, Credit AR
        for (const payment of order.payments) {
          const existingPay = await db.journalEntry.findFirst({
            where: { tenantId: tenant.id, refType: 'payment', refId: payment.id },
          })
          if (existingPay) continue

          const cashAccount = payment.method === 'cash' ? '1000' : '1010'
          await postJournalEntry({
            tenantId: tenant.id,
            description: `Payment for ${order.orderNumber} (${payment.method})`,
            refType: 'payment',
            refId: payment.id,
            lines: [
              { accountCode: cashAccount, debit: payment.amount },
              { accountCode: '1100', credit: payment.amount },
            ],
          })
        }

        orderCount++
      } catch (e) {
        console.error(`  ✗ Failed for order ${order.orderNumber}:`, e)
      }
    }
    console.log(`  ✓ Backfilled ${orderCount} sales orders`)

    // 3. Backfill PO journal entries (received POs)
    const pos = await db.purchaseOrder.findMany({
      where: { tenantId: tenant.id, status: 'received' },
      include: { supplier: true },
    })

    let poCount = 0
    for (const po of pos) {
      const existing = await db.journalEntry.findFirst({
        where: { tenantId: tenant.id, refType: 'purchase_order', refId: po.id },
      })
      if (existing) continue

      try {
        await postJournalEntry({
          tenantId: tenant.id,
          description: `PO ${po.poNumber} received (${po.supplier.name})`,
          refType: 'purchase_order',
          refId: po.id,
          lines: [
            { accountCode: '1200', debit: po.total },
            { accountCode: '2000', credit: po.total },
          ],
        })
        poCount++
      } catch (e) {
        console.error(`  ✗ Failed for PO ${po.poNumber}:`, e)
      }
    }
    console.log(`  ✓ Backfilled ${poCount} purchase orders`)

    // 4. Backfill expense transactions (non-PO expenses like payroll, rent, etc.)
    const transactions = await db.transaction.findMany({
      where: { tenantId: tenant.id, refType: { not: 'sales_order' } },
    })

    let txnCount = 0
    for (const txn of transactions) {
      const existing = await db.journalEntry.findFirst({
        where: { tenantId: tenant.id, refType: 'transaction', refId: txn.id },
      })
      if (existing) continue

      try {
        if (txn.type === 'expense') {
          // Map expense category to account code
          const accountMap: Record<string, string> = {
            'Payroll': '6000',
            'Rent': '6100',
            'Utilities': '6200',
            'Marketing': '6300',
            'Supplies': '6400',
            'Software': '6500',
            'Travel': '6600',
            'Equipment': '1500',
          }
          const expenseAccount = accountMap[txn.category] || '6900'
          await postJournalEntry({
            tenantId: tenant.id,
            description: txn.description,
            refType: 'transaction',
            refId: txn.id,
            lines: [
              { accountCode: expenseAccount, debit: txn.amount },
              { accountCode: '1000', credit: txn.amount },
            ],
          })
        } else if (txn.type === 'income' && txn.refType !== 'sales_order') {
          // Subscription/other income
          await postJournalEntry({
            tenantId: tenant.id,
            description: txn.description,
            refType: 'transaction',
            refId: txn.id,
            lines: [
              { accountCode: '1000', debit: txn.amount },
              { accountCode: '4000', credit: txn.amount },
            ],
          })
        }
        txnCount++
      } catch (e) {
        // Skip if already exists or error
      }
    }
    console.log(`  ✓ Backfilled ${txnCount} transactions`)

    // 5. Show resulting balances
    const accounts = await db.account.findMany({
      where: { tenantId: tenant.id, balance: { not: 0 } },
      orderBy: { type: 'asc' },
    })
    console.log(`\n  Account balances for ${tenant.name}:`)
    for (const a of accounts) {
      console.log(`    ${a.code} ${a.name}: ${a.type} = $${a.balance.toFixed(2)}`)
    }
  }

  console.log('\n✅ Backfill complete!')
  const totalEntries = await db.journalEntry.count()
  const totalLines = await db.journalLine.count()
  console.log(`Total journal entries: ${totalEntries}`)
  console.log(`Total journal lines: ${totalLines}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
