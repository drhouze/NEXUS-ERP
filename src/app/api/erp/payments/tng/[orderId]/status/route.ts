import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/payments/tng/[orderId]/status - check payment status (polled by client)
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params

  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    select: { total: true, paidAmount: true },
  })

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const balance = order.total - (order.paidAmount || 0)
  return NextResponse.json({
    status: balance <= 0 ? 'paid' : 'pending',
    paidAmount: order.paidAmount || 0,
    total: order.total,
    balance,
  })
}
