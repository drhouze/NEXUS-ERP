import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import QRCode from 'qrcode'
import { logAction } from '@/lib/audit'

/**
 * POST /api/erp/partner-shops/redeem
 * Body: { itemId: string }
 *
 * Employee initiates a redemption — generates a QR code + short code.
 * Status flow: pending → scanned → confirmed / cancelled
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { itemId } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 })

    // Look up the item across own tenant + global shops from ALL tenants
    // (cross-tenant marketplace: employees can redeem at any global shop)
    const item = await db.shopCatalogItem.findFirst({
      where: {
        id: itemId,
        isActive: true,
        shop: {
          isActive: true,
          OR: [
            { tenantId: user.tenantId },
            { isGlobal: true },
          ],
        },
      },
      include: { shop: true },
    })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (item.stock === 0) return NextResponse.json({ error: 'Item is out of stock' }, { status: 400 })

    // Check points balance
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { points: true } })
    const currentPoints = dbUser?.points || 0
    if (currentPoints < item.pointsCost) {
      return NextResponse.json({
        error: `Not enough points. You need ${item.pointsCost}, you have ${currentPoints}.`,
      }, { status: 400 })
    }

    // Generate short code + token
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const token = `${shortCode}-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`

    const redemption = await db.redemptionCode.create({
      data: {
        tenantId: user.tenantId,
        code: shortCode,
        token,
        employeeId: user.id,
        shopId: item.shopId,
        itemId: item.id,
        pointsCost: item.pointsCost,
        status: 'pending',
      },
      include: { item: true, shop: true },
    })

    // Generate QR code data URL
    const qrPayload = JSON.stringify({
      type: 'nexus-redemption',
      token,
      code: shortCode,
      shopId: item.shopId,
      itemId: item.id,
    })
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#263373', light: '#ffffff' },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'create',
      entityType: 'redemption_code',
      entityId: redemption.id,
      entityName: shortCode,
      summary: `${user.name} generated redemption ${shortCode} for "${item.name}" at ${item.shop.name} (${item.pointsCost} points)`,
    })

    return NextResponse.json({
      redemption: {
        id: redemption.id,
        code: shortCode,
        token,
        qrCodeDataUrl,
        item: {
          id: item.id, name: item.name, description: item.description,
          rewardType: item.rewardType, rewardDetails: item.rewardDetails,
          pointsCost: item.pointsCost, imageUrl: item.imageUrl,
        },
        shop: { id: item.shop.id, name: item.shop.name, logoUrl: item.shop.logoUrl },
        pointsCost: item.pointsCost,
        status: 'pending',
      },
    })
  } catch (e: any) {
    console.error('Generate redemption error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** GET — list current user's redemptions */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status')

  // Support comma-separated status values: ?status=pending,scanned,confirmed
  const statuses = statusFilter ? statusFilter.split(',').map(s => s.trim()).filter(Boolean) : null

  const redemptions = await db.redemptionCode.findMany({
    where: {
      tenantId: user.tenantId,
      employeeId: user.id,
      ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
    },
    include: { item: true, shop: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ redemptions })
}
