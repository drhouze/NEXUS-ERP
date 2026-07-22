import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// PATCH /api/erp/purchase-orders/[id] - update PO status (e.g. draft → sent)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'purchasing')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { supplier: true } })
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  if (user.role !== 'OWNER' && po.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.status) updates.status = body.status

    const updated = await db.purchaseOrder.update({ where: { id }, data: updates, include: { supplier: true } })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: po.tenantId },
      action: 'status_change',
      entityType: 'purchase_order',
      entityId: id,
      entityName: po.poNumber,
      summary: `PO ${po.poNumber} status: ${po.status} → ${updated.status}`,
      metadata: { from: po.status, to: updated.status },
    })

    return NextResponse.json({ po: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
