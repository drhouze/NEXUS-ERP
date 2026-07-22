import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/inventory/batches
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const url = new URL(req.url)
  const productId = url.searchParams.get('productId')
  const where: any = filter
  if (productId) where.productId = productId

  const batches = await db.batch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { product: true, warehouse: true },
  })

  // Mark expired batches
  const now = new Date()
  const enriched = batches.map(b => ({
    ...b,
    isExpired: b.expiryDate ? new Date(b.expiryDate) < now : false,
    daysToExpiry: b.expiryDate ? Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86400000) : null,
  }))

  return NextResponse.json({ batches: enriched })
}

// POST - create batch
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, batchNumber, quantity, manufactureDate, expiryDate, warehouseId, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    if (!productId || !batchNumber || !quantity) {
      return NextResponse.json({ error: 'Product, batch number, and quantity required' }, { status: 400 })
    }

    const existing = await db.batch.findUnique({ where: { tenantId_batchNumber: { tenantId, batchNumber } } })
    if (existing) return NextResponse.json({ error: 'Batch number already exists' }, { status: 400 })

    const batch = await db.batch.create({
      data: {
        tenantId, productId, batchNumber,
        quantity: parseInt(quantity),
        manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        warehouseId: warehouseId || null,
      },
    })

    return NextResponse.json({ batch })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
