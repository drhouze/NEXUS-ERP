import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { generateNumber } from '@/lib/numbering'

// POST /api/erp/purchase-orders - create a purchase order with line items
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { supplierId, status, items, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Supplier and at least one line item are required' }, { status: 400 })
    }

    const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId } })
    if (!supplier) return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })

    const productIds = items.map((it: any) => it.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds }, tenantId } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more invalid products' }, { status: 400 })
    }

    const lineItems = items.map((it: any) => {
      const product = products.find(p => p.id === it.productId)!
      return { productId: it.productId, qty: parseInt(it.qty) || 1, unitCost: product.cost }
    })
    const total = lineItems.reduce((s: number, it: any) => s + it.qty * it.unitCost, 0)

    const poNumber = await generateNumber(tenantId, 'purchaseOrder')

    const po = await db.purchaseOrder.create({
      data: { tenantId, poNumber, supplierId, status: status || 'draft', total, items: { create: lineItems } },
      include: { supplier: true, items: { include: { product: true } } },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'purchase_order',
      entityId: po.id,
      entityName: po.poNumber,
      summary: `Created PO ${po.poNumber} to ${supplier.name} - $${total.toFixed(0)}`,
    })

    return NextResponse.json({ po })
  } catch (e: any) {
    console.error('Create PO error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
