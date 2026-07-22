import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/inventory/serials
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const url = new URL(req.url)
  const productId = url.searchParams.get('productId')
  const where: any = filter
  if (productId) where.productId = productId

  const serials = await db.serialNumber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { product: true, warehouse: true },
  })

  return NextResponse.json({ serials })
}

// POST - add serial numbers
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, serialNumbers, warehouseId, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    if (!productId || !serialNumbers || !Array.isArray(serialNumbers)) {
      return NextResponse.json({ error: 'Product and serial numbers array required' }, { status: 400 })
    }

    const created = []
    for (const sn of serialNumbers) {
      try {
        const record = await db.serialNumber.create({
          data: { tenantId, productId, serialNumber: sn, warehouseId: warehouseId || null },
        })
        created.push(record)
      } catch (e) {
        // Skip duplicates
      }
    }

    return NextResponse.json({ created: created.length, serials: created })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
