import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/inventory/boms
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const boms = await db.billOfMaterial.findMany({
    where: filter,
    include: {
      product: true,
      components: { include: { component: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ boms })
}

// POST - create BOM
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, components, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? (targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    if (!productId || !components || !Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ error: 'Product and components required' }, { status: 400 })
    }

    // Check if BOM already exists for this product
    const existing = await db.billOfMaterial.findFirst({ where: { productId, tenantId } })
    if (existing) return NextResponse.json({ error: 'BOM already exists for this product' }, { status: 400 })

    const bom = await db.billOfMaterial.create({
      data: {
        tenantId, productId,
        components: {
          create: components.map((c: any) => ({
            componentProductId: c.componentProductId,
            quantity: parseInt(c.quantity) || 1,
          })),
        },
      },
      include: { product: true, components: { include: { component: true } } },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'bom', entityId: bom.id, entityName: bom.product.name,
      summary: `Created BOM for "${bom.product.name}" with ${components.length} components`,
    })

    return NextResponse.json({ bom })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
