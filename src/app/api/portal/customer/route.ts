import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/portal/customer - customer login via email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const customer = await db.customer.findFirst({
      where: { email: email.toLowerCase() },
    })
    if (!customer) return NextResponse.json({ error: 'No customer found with that email' }, { status: 404 })

    const orders = await db.salesOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name, company: customer.company, email: customer.email, phone: customer.phone, status: customer.status, totalSpent: customer.totalSpent },
      orders,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
