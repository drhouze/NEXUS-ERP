import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/duitnow/[orderId] - generate DuitNow QR for payment
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params

  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { customer: true, tenant: { include: { duitNowSettings: true } } },
  })

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const balance = order.total - (order.paidAmount || 0)
  if (balance <= 0) return NextResponse.json({ error: 'Order is already fully paid' }, { status: 400 })

  // Check if tenant has DuitNow settings
  const duitNow = order.tenant.duitNowSettings
  const isLive = duitNow?.isLive && duitNow?.merchantId

  // Build payment link
  const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const paymentLink = `${baseUrl}/pay/duitnow/${orderId}`

  // Generate QR code
  const QRCode = (await import('qrcode')).default
  const qrCodeUrl = await QRCode.toDataURL(paymentLink, {
    width: 300, margin: 2,
    color: { dark: '#1e40af', light: '#ffffff' },
  })

  // Supported e-wallets (shown on payment page)
  const supportedWallets = [
    { name: 'Touch \'n Go', icon: '📱', color: '#00A859' },
    { name: 'GrabPay', icon: '🟢', color: '#00B14F' },
    { name: 'Boost', icon: '🟠', color: '#F26B21' },
    { name: 'Maybank QRPay', icon: '🏦', color: '#FFC107' },
    { name: 'CIMB QRPay', icon: '🏛️', color: '#7B1FA2' },
    { name: 'ShopeePay', icon: '🛍️', color: '#EE4D2D' },
    { name: 'RHB Pay', icon: '💳', color: '#00529B' },
    { name: 'All Malaysian Bank Apps', icon: '🏦', color: '#37474F' },
  ]

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      paidAmount: order.paidAmount || 0,
      balance,
      customer: { company: order.customer.company, name: order.customer.name },
      tenant: { name: order.tenant.name },
    },
    qrCodeUrl,
    paymentLink,
    isLive,
    merchantName: duitNow?.displayName || 'Pay with DuitNow QR',
    supportedWallets,
  })
}
