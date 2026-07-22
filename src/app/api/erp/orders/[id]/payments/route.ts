import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { generateNumber } from '@/lib/numbering'
import { seedChartOfAccounts, postJournalEntry } from '@/lib/accounting'
import { broadcast, REALTIME_EVENTS } from '@/lib/realtime'

// GET /api/erp/orders/[id]/payments - list payments for an order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const order = await db.salesOrder.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payments = await db.payment.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    payments,
    total: order.total,
    paidAmount: order.paidAmount,
    balance: order.total - order.paidAmount,
  })
}

/**
 * POST /api/erp/orders/[id]/payments - record a payment (partial or full)
 *
 * Body: { amount, method, reference, notes }
 *
 * Special methods:
 *   - method='deposit'  → allow overpayment (no balance check). Used when
 *     taking a deposit before the final total is known.
 *   - method='refund'   → decrement paidAmount, store as a NEGATIVE amount,
 *     and create an expense transaction.
 *
 * Regular payments (cash/card/bank_transfer/check/other) are checked against
 * the remaining balance.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const order = await db.salesOrder.findUnique({ where: { id }, include: { customer: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const method = String(body.method || 'cash')
    const rawAmount = parseFloat(body.amount)
    if (Number.isNaN(rawAmount) || rawAmount === 0) {
      return NextResponse.json({ error: 'Amount must be a non-zero number' }, { status: 400 })
    }

    const isDeposit = method === 'deposit'
    const isRefund = method === 'refund'

    // Refund → store as a negative amount.
    const paymentAmount = isRefund ? -Math.abs(rawAmount) : Math.abs(rawAmount)

    // ---- Balance checks ----
    if (!isDeposit && !isRefund) {
      const balance = order.total - order.paidAmount
      if (paymentAmount > balance + 0.01) {
        return NextResponse.json(
          { error: `Payment exceeds remaining balance of ${order.currency} ${balance.toFixed(2)}` },
          { status: 400 },
        )
      }
    }
    if (isRefund) {
      // Can't refund more than what's been paid.
      if (Math.abs(paymentAmount) > order.paidAmount + 0.01) {
        return NextResponse.json(
          { error: `Refund exceeds paid amount of ${order.currency} ${order.paidAmount.toFixed(2)}` },
          { status: 400 },
        )
      }
    }

    const txnNumber = await generateNumber(order.tenantId, 'transaction')

    const result = await db.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: paymentAmount,
          method,
          reference: body.reference || null,
          notes: body.notes || null,
        },
      })

      // Update order paidAmount (increment handles both +payment and -refund)
      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: { paidAmount: { increment: paymentAmount } },
      })

      if (isRefund) {
        // Expense transaction for the refund
        await tx.transaction.create({
          data: {
            tenantId: order.tenantId,
            type: 'expense',
            category: 'Refund',
            amount: Math.abs(paymentAmount),
            description: `Refund for ${order.orderNumber} (${body.reference || method})`,
            date: new Date(),
            refType: 'sales_order',
            refId: order.id,
          },
        })
      } else {
        // Income transaction for the payment (covers regular + deposit)
        await tx.transaction.create({
          data: {
            tenantId: order.tenantId,
            type: 'income',
            category: isDeposit ? 'Deposit' : 'Product Sales',
            amount: paymentAmount,
            description: `Payment for ${order.orderNumber} (${method})`,
            date: new Date(),
            refType: 'sales_order',
            refId: order.id,
          },
        })
      }

      return { payment, updated }
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
      action: isRefund ? 'create' : 'create',
      entityType: 'transaction',
      entityId: result.payment.id,
      entityName: order.orderNumber,
      summary:
        (isRefund ? `Refunded ${order.currency} ${Math.abs(paymentAmount).toFixed(2)} from`
          : isDeposit ? `Recorded deposit of ${order.currency} ${paymentAmount.toFixed(2)} for`
          : `Recorded ${method} payment of ${order.currency} ${paymentAmount.toFixed(2)} for`)
        + ` ${order.orderNumber} (${order.customer.company})`,
      metadata: { orderId: order.id, amount: paymentAmount, method, txnNumber },
    })

    // Post double-entry journal entry
    try {
      await seedChartOfAccounts(order.tenantId)
      if (isRefund) {
        // Reverse of a payment: Credit Cash, Debit AR
        const cashAccountCode = '1000'
        await postJournalEntry({
          tenantId: order.tenantId,
          description: `Refund for ${order.orderNumber} (${method})`,
          refType: 'payment',
          refId: result.payment.id,
          lines: [
            { accountCode: '1100', debit: Math.abs(paymentAmount), description: 'Accounts Receivable (refund)' },
            { accountCode: cashAccountCode, credit: Math.abs(paymentAmount), description: 'Cash/Bank refunded' },
          ],
        })
      } else {
        const cashAccountCode = method === 'cash' ? '1000' : '1010' // Cash or Bank
        await postJournalEntry({
          tenantId: order.tenantId,
          description: `Payment received for ${order.orderNumber} (${method})`,
          refType: 'payment',
          refId: result.payment.id,
          lines: [
            { accountCode: cashAccountCode, debit: paymentAmount, description: 'Cash/Bank received' },
            { accountCode: '1100', credit: paymentAmount, description: 'Accounts Receivable' },
          ],
        })
      }
    } catch (e) {
      console.error('Journal entry for payment failed:', e)
    }

    // Broadcast real-time update
    broadcast(order.tenantId, REALTIME_EVENTS.PAYMENT_RECEIVED, {
      orderNumber: order.orderNumber,
      amount: paymentAmount,
      method,
    }).catch(console.error)
    broadcast(order.tenantId, REALTIME_EVENTS.DASHBOARD_REFRESH).catch(console.error)

    const newPaidAmount = result.updated.paidAmount
    return NextResponse.json({
      payment: result.payment,
      paidAmount: newPaidAmount,
      balance: result.updated.total - newPaidAmount,
      fullyPaid: newPaidAmount >= result.updated.total - 0.01,
    })
  } catch (e: any) {
    console.error('Record payment error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
