import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/portal/supplier - supplier login via email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supplier = await db.supplier.findFirst({
      where: { email: email.toLowerCase() },
    })
    if (!supplier) return NextResponse.json({ error: 'No supplier found with that email' }, { status: 404 })

    const orders = await db.purchaseOrder.findMany({
      where: { supplierId: supplier.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      supplier: { id: supplier.id, name: supplier.name, contactName: supplier.contactName, email: supplier.email, phone: supplier.phone, country: supplier.country, rating: supplier.rating },
      orders,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
