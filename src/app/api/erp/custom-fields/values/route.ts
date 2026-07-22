import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * GET /api/erp/custom-fields/values
 *
 * Two modes:
 *   - ?entityType=X&entityId=Y → returns { values: [{ fieldKey, value }], valuesMap: { fieldKey: value } }
 *   - ?module=X                → returns { fields: [...] } (active, showInForm=true defs for that module)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const moduleKey = searchParams.get('module')

  const tenantFilter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  // ---- Values for a specific entity ----
  if (entityType && entityId) {
    const rows = await db.customFieldValue.findMany({
      where: { ...tenantFilter, entityType, entityId },
      include: { customField: { select: { fieldKey: true, label: true, type: true } } },
    })

    // Array form (consumed by the custom-fields-renderer) + map form for convenience.
    const values = rows.map(r => ({
      id: r.id,
      fieldKey: r.customField?.fieldKey,
      value: r.value,
      customField: r.customField,
    }))
    const valuesMap: Record<string, string> = {}
    for (const v of values) {
      if (v.fieldKey) valuesMap[v.fieldKey] = v.value
    }

    return NextResponse.json({ values, valuesMap })
  }

  // ---- Field definitions for a module (active + showInForm) ----
  if (moduleKey) {
    const fields = await db.customField.findMany({
      where: { ...tenantFilter, module: moduleKey, isActive: true, showInForm: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    })
    return NextResponse.json({ fields })
  }

  return NextResponse.json({ error: 'Provide entityType+entityId or module' }, { status: 400 })
}

/**
 * POST /api/erp/custom-fields/values
 * Body: { entityType, entityId, values: { fieldKey: value } }
 *       (also accepts `module` in place of entityType — the custom-fields-renderer
 *        posts { module, entityId, values })
 *
 * Upserts each value using the (customFieldId, entityId) compound key.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory') && !canWrite(user.role, 'customers') && !canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const entityType = String(body.entityType || body.module || '')
    const entityId = String(body.entityId || '')
    const values: Record<string, any> = body.values || {}

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType (or module) and entityId are required' }, { status: 400 })
    }

    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    // Derive the module from entityType (they usually match: "customer" → "customer",
    // "product" → "product"). When they differ (e.g. entityType="customer_order",
    // module="order") the field's own `module` is what we look up by.
    const moduleKey = String(body.module || entityType)

    // Fetch all field defs for this module + tenant once.
    const defs = await db.customField.findMany({ where: { tenantId, module: moduleKey } })
    const defByKey = new Map(defs.map(d => [d.fieldKey, d]))

    let upserted = 0
    for (const [fieldKey, rawValue] of Object.entries(values)) {
      const def = defByKey.get(fieldKey)
      if (!def) continue // unknown field — skip silently
      const value = rawValue == null ? '' : String(rawValue)
      await db.customFieldValue.upsert({
        where: {
          customFieldId_entityId: { customFieldId: def.id, entityId },
        },
        create: {
          tenantId,
          customFieldId: def.id,
          entityType,
          entityId,
          value,
        },
        update: { value },
      })
      upserted++
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'update',
      entityType: 'custom_field_value',
      entityId,
      summary: `Saved ${upserted} custom field value(s) for ${entityType}#${entityId}`,
      metadata: { entityType, entityId, module, count: upserted },
    })

    return NextResponse.json({ ok: true, upserted })
  } catch (e: any) {
    console.error('Save custom field values error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
