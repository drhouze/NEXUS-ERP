import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { generateNumber } from '@/lib/numbering'

// POST /api/erp/products/[id]/reorder - auto-create a draft PO to restock this product
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const product = await db.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  if (user.role !== 'OWNER' && product.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = product.tenantId

  // Check if product has a supplier
  if (!product.supplierId) {
    return NextResponse.json({ error: 'Product has no supplier assigned. Assign a supplier first.' }, { status: 400 })
  }

  // Calculate reorder quantity: restock to 3x reorder level
  const reorderQty = Math.max(product.reorderLevel * 3 - product.stockQty, product.reorderLevel)

  const poNumber = await generateNumber(tenantId, 'purchaseOrder')

  const po = await db.purchaseOrder.create({
    data: {
      tenantId,
      poNumber,
      supplierId: product.supplierId,
      status: 'draft',
      total: reorderQty * product.cost,
      items: {
        create: [{
          productId: product.id,
          qty: reorderQty,
          unitCost: product.cost,
        }],
      },
    },
    include: { supplier: true, items: { include: { product: true } } },
  })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
    action: 'create',
    entityType: 'purchase_order',
    entityId: po.id,
    entityName: po.poNumber,
    summary: `Auto-created PO ${po.poNumber} to restock "${product.name}" (${reorderQty} units from ${po.supplier.name})`,
    metadata: { productId: product.id, productName: product.name, reorderQty },
  })

  return NextResponse.json({ po, message: `Created draft PO ${po.poNumber} for ${reorderQty} units` })
}
