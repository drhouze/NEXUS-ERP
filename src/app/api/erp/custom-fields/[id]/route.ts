import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { FIELD_TYPES, FORMULA_TYPES, slugify } from '../route'

// DELETE /api/erp/custom-fields/[id]  — delete a custom field (cascades to values)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory') && !canWrite(user.role, 'customers') && !canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const field = await db.customField.findUnique({ where: { id } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && field.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Cascade delete happens at the DB level via onDelete: Cascade on CustomFieldValue.
  await db.customField.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: field.tenantId },
    action: 'delete',
    entityType: 'custom_field',
    entityId: id,
    entityName: field.label,
    summary: `Deleted custom field "${field.label}" (${field.fieldKey}) on ${field.module}`,
    metadata: { module: field.module, fieldKey: field.fieldKey },
  })

  return NextResponse.json({ ok: true })
}

// PATCH /api/erp/custom-fields/[id]  — update a custom field
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory') && !canWrite(user.role, 'customers') && !canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const field = await db.customField.findUnique({ where: { id } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && field.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ---- Validate type / formulaType if provided ----
    const newType = body.type !== undefined ? String(body.type) : field.type
    if (body.type !== undefined && !FIELD_TYPES.includes(newType as any)) {
      return NextResponse.json({ error: `Invalid type: ${newType}` }, { status: 400 })
    }
    let newFormulaType: string | null = field.formulaType
    if (body.formulaType !== undefined) {
      newFormulaType = body.formulaType ? String(body.formulaType) : null
      if (newFormulaType && !FORMULA_TYPES.includes(newFormulaType as any)) {
        return NextResponse.json({ error: `Invalid formulaType: ${newFormulaType}` }, { status: 400 })
      }
    }

    const isCalculatedFamily = newType === 'formula' || newType === 'calculated'

    // ---- Build the patch, clearing irrelevant config when the type changes ----
    const patch: any = {}
    if (body.label !== undefined) {
      patch.label = String(body.label).trim() || field.label
      // Re-slug only if the user didn't explicitly pass a fieldKey AND the label changed.
      if (body.fieldKey === undefined) {
        patch.fieldKey = slugify(patch.label)
      }
    }
    if (body.fieldKey !== undefined) patch.fieldKey = String(body.fieldKey)
    if (body.type !== undefined) patch.type = newType
    if (body.sortOrder !== undefined) patch.sortOrder = parseInt(body.sortOrder) || 0
    if (body.isActive !== undefined) patch.isActive = !!body.isActive
    if (body.isRequired !== undefined) patch.isRequired = !!body.isRequired
    if (body.showInTable !== undefined) patch.showInTable = !!body.showInTable
    if (body.showInForm !== undefined) patch.showInForm = !!body.showInForm
    if (body.isFilterable !== undefined) patch.isFilterable = !!body.isFilterable

    // options only meaningful for select
    if (body.options !== undefined) {
      patch.options =
        newType === 'select'
          ? Array.isArray(body.options)
            ? JSON.stringify(body.options.map(String))
            : body.options || null
          : null
    }
    // defaultValue is always allowed (any type can have one)
    if (body.defaultValue !== undefined) {
      patch.defaultValue = body.defaultValue == null ? null : String(body.defaultValue)
    }
    // formula / sourceField / formulaType only meaningful for calculated family
    if (body.formula !== undefined) {
      patch.formula = isCalculatedFamily ? (body.formula ? String(body.formula) : null) : null
    }
    if (body.sourceField !== undefined) {
      patch.sourceField = isCalculatedFamily ? (body.sourceField ? String(body.sourceField) : null) : null
    }
    if (body.formulaType !== undefined) {
      patch.formulaType = isCalculatedFamily ? newFormulaType : null
    }

    // ---- Uniqueness check if fieldKey changed ----
    if (patch.fieldKey && patch.fieldKey !== field.fieldKey) {
      const clash = await db.customField.findUnique({
        where: {
          tenantId_module_fieldKey: {
            tenantId: field.tenantId,
            module: field.module,
            fieldKey: patch.fieldKey,
          },
        },
      })
      if (clash) {
        return NextResponse.json(
          { error: `A field with key "${patch.fieldKey}" already exists for module "${field.module}"` },
          { status: 409 },
        )
      }
    }

    const updated = await db.customField.update({ where: { id }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: field.tenantId },
      action: 'update',
      entityType: 'custom_field',
      entityId: id,
      entityName: updated.label,
      summary: `Updated custom field "${updated.label}" (${updated.fieldKey})`,
      metadata: { module: updated.module, changes: Object.keys(patch) },
    })

    return NextResponse.json({ field: updated })
  } catch (e: any) {
    console.error('Update custom field error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
