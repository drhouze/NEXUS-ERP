import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

// GET /api/erp/partner-shops — list all partner shops (+ catalog for employees)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const url = new URL(req.url)
  const withCatalog = url.searchParams.get('withCatalog') === 'true'
  const globalOnly = url.searchParams.get('global') === 'true'

  // Show:
  //   - This tenant's own shops (always)
  //   - Global shops from ALL tenants (cross-tenant marketplace)
  const where: any = {
    isActive: true,
    OR: [
      { tenantId: user.tenantId },
      { isGlobal: true },
    ],
  }
  if (globalOnly) {
    // Only global shops from OTHER tenants
    where.isGlobal = true
    where.tenantId = { not: user.tenantId }
  }

  const shops = await db.partnerShop.findMany({
    where,
    include: withCatalog ? {
      catalog: {
        where: { isActive: true },
        orderBy: { pointsCost: 'asc' },
      },
      tenant: { select: { id: true, name: true } },
    } : {
      tenant: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ shops })
}

// POST /api/erp/partner-shops — create a partner shop (admin only)
// Also creates a shop owner user account if email+password provided
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'settings')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, description, logoUrl, category, ownerUserId, ownerEmail, ownerName, ownerPassword, isGlobal } = body

    if (!name) return NextResponse.json({ error: 'Shop name is required' }, { status: 400 })

    let finalOwnerUserId = ownerUserId

    // If owner credentials provided, create a new EMPLOYEE user as the shop owner
    if (!finalOwnerUserId && ownerEmail && ownerName && ownerPassword) {
      const existing = await db.user.findUnique({ where: { email: ownerEmail } })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
      const newOwner = await db.user.create({
        data: {
          email: ownerEmail,
          name: ownerName,
          password: bcrypt.hashSync(ownerPassword, 10),
          role: 'EMPLOYEE', // shop owners are EMPLOYEE role with a linked shop
          tenantId: user.tenantId,
          status: 'active',
        },
      })
      finalOwnerUserId = newOwner.id
    }

    if (!finalOwnerUserId) {
      return NextResponse.json({ error: 'Shop owner is required (select existing or create new)' }, { status: 400 })
    }

    const shop = await db.partnerShop.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        category: category || 'General',
        ownerUserId: finalOwnerUserId,
        isGlobal: !!isGlobal,
      },
      include: { owner: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ shop })
  } catch (e: any) {
    console.error('Create partner shop error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
