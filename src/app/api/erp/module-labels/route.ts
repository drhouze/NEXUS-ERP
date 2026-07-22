import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// GET /api/erp/module-labels — list all module labels for the tenant
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const labels = await db.moduleLabel.findMany({
    where: filter,
    orderBy: { moduleKey: 'asc' },
  })

  // Also return as a map for quick lookup: { [moduleKey]: { label, description } }
  const map: Record<string, { label: string; description: string | null }> = {}
  for (const l of labels) {
    map[l.moduleKey] = { label: l.label, description: l.description }
  }

  return NextResponse.json({ labels, map })
}

// PATCH /api/erp/module-labels — upsert a single module label
// Body: { moduleKey, label, description? }
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const moduleKey = String(body.moduleKey || '').trim()
    const label = String(body.label || '').trim()
    if (!moduleKey || !label) {
      return NextResponse.json({ error: 'moduleKey and label are required' }, { status: 400 })
    }
    const description = body.description != null ? String(body.description) : null

    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    const existing = await db.moduleLabel.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    })

    let row
    if (existing) {
      row = await db.moduleLabel.update({
        where: { tenantId_moduleKey: { tenantId, moduleKey } },
        data: { label, description },
      })
    } else {
      row = await db.moduleLabel.create({
        data: { tenantId, moduleKey, label, description },
      })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: existing ? 'update' : 'create',
      entityType: 'module_label',
      entityId: row.id,
      entityName: moduleKey,
      summary: `${existing ? 'Updated' : 'Created'} module label "${moduleKey}" → "${label}"`,
      metadata: { moduleKey, label },
    })

    return NextResponse.json({ label: row })
  } catch (e: any) {
    console.error('Upsert module label error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
