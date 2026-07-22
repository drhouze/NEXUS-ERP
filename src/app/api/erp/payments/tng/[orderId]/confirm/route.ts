import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { broadcast, REALTIME_EVENTS } from '@/lib/realtime'
import { seedChartOfAccounts, postJournalEntry } from '@/lib/accounting'

// POST /api/erp/payments/tng/[orderId]/confirm - confirm TNG payment (simulates TNG webhook callback)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params

  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { customer: true },
  })

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const balance = order.total - (order.paidAmount || 0)
  if (balance <= 0) return NextResponse.json({ error: 'Order already fully paid' }, { status: 400 })

  try {
    const amount = balance // full payment

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount,
          currency: order.currency || 'USD',
          method: 'tng',
          reference: `TNG-${Date.now()}`,
          notes: "Touch 'n Go eWallet payment",
        },
      })

      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: { paidAmount: { increment: amount } },
      })

      await tx.transaction.create({
        data: {
          tenantId: order.tenantId,
          type: 'income',
          category: 'Product Sales',
          amount,
          description: `TNG payment for ${order.orderNumber}`,
          date: new Date(),
          refType: 'sales_order',
          refId: order.id,
        },
      })

      return { payment, updated }
    })

    try {
      await seedChartOfAccounts(order.tenantId)
      await postJournalEntry({
        tenantId: order.tenantId,
        description: `TNG payment for ${order.orderNumber}`,
        refType: 'payment',
        refId: result.payment.id,
        lines: [
          { accountCode: '1000', debit: amount, description: 'Cash (TNG)' },
          { accountCode: '1100', credit: amount, description: 'Accounts Receivable' },
        ],
      })
    } catch (e) {
      console.error('Journal entry for TNG payment failed:', e)
    }

    await logAction({
      ctx: { actorEmail: order.customer.email, actorRole: 'CUSTOMER', tenantId: order.tenantId },
      action: 'create', entityType: 'transaction', entityId: result.payment.id,
      summary: `TNG payment of ${amount} received for ${order.orderNumber} (${order.customer.company})`,
    })

    broadcast(order.tenantId, REALTIME_EVENTS.PAYMENT_RECEIVED, {
      orderNumber: order.orderNumber, amount, method: 'tng',
    }).catch(console.error)
    broadcast(order.tenantId, REALTIME_EVENTS.DASHBOARD_REFRESH).catch(console.error)

    return NextResponse.json({ ok: true, paid: true, amount })
  } catch (e: any) {
    console.error('TNG confirm error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
