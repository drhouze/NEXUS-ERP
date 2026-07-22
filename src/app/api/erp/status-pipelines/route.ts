import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import {
  getOrCreatePipeline,
  DEFAULT_ORDER_STATUSES,
  DEFAULT_PO_STATUSES,
  DEFAULT_CUSTOMER_STATUSES,
  DEFAULT_EMPLOYEE_STATUSES,
} from '@/lib/status-pipeline'

// Re-export the defaults so consumers that imported them from this route
// (prior to the lib refactor) still resolve.
export {
  DEFAULT_ORDER_STATUSES,
  DEFAULT_PO_STATUSES,
  DEFAULT_CUSTOMER_STATUSES,
  DEFAULT_EMPLOYEE_STATUSES,
}

function parseArr(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

// GET /api/erp/status-pipelines
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const p = await getOrCreatePipeline(user.tenantId)

  return NextResponse.json({
    pipeline: {
      ...p,
      orderStatuses: parseArr(p.orderStatuses),
      poStatuses: parseArr(p.poStatuses),
      customerStatuses: parseArr(p.customerStatuses),
      employeeStatuses: parseArr(p.employeeStatuses),
    },
  })
}

// PATCH /api/erp/status-pipelines
// Body: any subset of { orderStatuses, poStatuses, customerStatuses, employeeStatuses }
// (each as a string[])
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const existing = await getOrCreatePipeline(user.tenantId)

    const patch: any = {}
    for (const k of ['orderStatuses', 'poStatuses', 'customerStatuses', 'employeeStatuses']) {
      if (body[k] !== undefined) {
        const arr = Array.isArray(body[k]) ? body[k] : []
        patch[k] = JSON.stringify(arr.map(String))
      }
    }

    const updated = await db.statusPipeline.update({ where: { tenantId: user.tenantId }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'update',
      entityType: 'status_pipeline',
      entityId: updated.id,
      summary: `Updated status pipeline`,
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({
      pipeline: {
        ...updated,
        orderStatuses: parseArr(updated.orderStatuses),
        poStatuses: parseArr(updated.poStatuses),
        customerStatuses: parseArr(updated.customerStatuses),
        employeeStatuses: parseArr(updated.employeeStatuses),
      },
    })
  } catch (e: any) {
    console.error('Update status pipeline error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
