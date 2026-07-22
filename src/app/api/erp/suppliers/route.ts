import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const suppliers = await db.supplier.findMany({
    where: filter,
    include: {
      products: { select: { id: true, name: true, sku: true, stockQty: true } },
      purchaseOrders: {
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { rating: 'desc' },
  })

  const purchaseOrders = await db.purchaseOrder.findMany({
    where: filter,
    include: { supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    suppliers,
    purchaseOrders,
    summary: {
      totalSuppliers: suppliers.length,
      totalPOs: purchaseOrders.length,
      draftPOs: purchaseOrders.filter(p => p.status === 'draft').length,
      sentPOs: purchaseOrders.filter(p => p.status === 'sent').length,
      receivedPOs: purchaseOrders.filter(p => p.status === 'received').length,
      totalSpend: purchaseOrders.filter(p => p.status === 'received').reduce((s, p) => s + p.total, 0),
      avgRating: suppliers.length ? suppliers.reduce((s, c) => s + c.rating, 0) / suppliers.length : 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, contactName, email, phone, country, rating, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!name || !contactName || !email) {
      return NextResponse.json({ error: 'Name, contact name and email are required' }, { status: 400 })
    }

    const existing = await db.supplier.findUnique({ where: { tenantId_name: { tenantId, name } } })
    if (existing) return NextResponse.json({ error: 'Supplier name already exists' }, { status: 400 })

    const supplier = await db.supplier.create({
      data: {
        tenantId, name, contactName, email: email.toLowerCase(),
        phone: phone || '', country: country || 'Unknown',
        rating: parseInt(rating) || 3,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'supplier',
      entityId: supplier.id,
      entityName: supplier.name,
      summary: `Created supplier "${supplier.name}"`,
    })

    return NextResponse.json({ supplier })
  } catch (e: any) {
    console.error('Create supplier error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
