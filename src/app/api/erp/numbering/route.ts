import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getNumberSettings, previewNextNumber } from '@/lib/numbering'
import { logAction } from '@/lib/audit'

// GET /api/erp/numbering - get tenant's number settings + preview next numbers
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'OWNER') return NextResponse.json({ isOwner: true })

  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const settings = await getNumberSettings(tenantId)

  // Preview next numbers for each entity type
  const previews: Record<string, string> = {}
  for (const type of ['salesOrder', 'purchaseOrder', 'invoice', 'customer', 'supplier', 'product', 'employee', 'transaction']) {
    previews[type] = await previewNextNumber(tenantId, type)
  }

  return NextResponse.json({ settings, previews })
}

// PATCH /api/erp/numbering - update prefixes + starting numbers
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const updates: any = {}

    // Allow updating prefix + start fields (not counters — those are internal)
    const allowedFields = [
      'salesOrderPrefix', 'salesOrderStart',
      'purchaseOrderPrefix', 'purchaseOrderStart',
      'invoicePrefix', 'invoiceStart',
      'customerPrefix', 'customerStart',
      'supplierPrefix', 'supplierStart',
      'productPrefix', 'productStart',
      'employeePrefix', 'employeeStart',
      'transactionPrefix', 'transactionStart',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field.endsWith('Start')) {
          updates[field] = parseInt(body[field])
        } else {
          updates[field] = body[field]
        }
      }
    }

    const settings = await db.tenantNumberSetting.upsert({
      where: { tenantId },
      create: { tenantId, ...updates },
      update: updates,
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'update', entityType: 'tenant', entityId: tenantId,
      summary: 'Updated numbering & prefix settings',
      metadata: updates,
    })

    return NextResponse.json({ settings })
  } catch (e: any) {
    console.error('Update numbering error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
