import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/partner-shops/[id]/catalog — list catalog items for a shop
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const shop = await db.partnerShop.findUnique({ where: { id } })
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  if (user.role !== 'OWNER' && shop.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items = await db.shopCatalogItem.findMany({
    where: { shopId: id, isActive: true },
    orderBy: { pointsCost: 'asc' },
  })

  return NextResponse.json({ items })
}

// POST /api/erp/partner-shops/[id]/catalog — add a catalog item (shop owner or admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const shop = await db.partnerShop.findUnique({ where: { id } })
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  if (user.role !== 'OWNER' && shop.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (user.role !== 'OWNER' && user.role !== 'TENANT_ADMIN' && shop.ownerUserId !== user.id) {
    return NextResponse.json({ error: 'Only the shop owner or admin can manage the catalog' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, rewardType, rewardDetails, pointsCost, imageUrl, stock } = body

    if (!name || pointsCost == null) {
      return NextResponse.json({ error: 'Name and points cost are required' }, { status: 400 })
    }

    const item = await db.shopCatalogItem.create({
      data: {
        tenantId: shop.tenantId,
        shopId: id,
        name,
        description: description || null,
        rewardType: rewardType || 'voucher',
        rewardDetails: rewardDetails || null,
        pointsCost: parseInt(pointsCost) || 0,
        imageUrl: imageUrl || null,
        stock: stock != null ? parseInt(stock) : -1,
      },
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
