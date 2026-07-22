import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// ============ Constants ============

export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'url',
  'email',
  'phone',
  'formula',
  'calculated',
] as const

export const FORMULA_TYPES = [
  'age_from_ic',
  'age_from_dob',
  'age_from_ic_or_dob',
  'ic_gender',
  'ic_dob',
  'expression',
] as const

export const MODULES = [
  'customer',
  'product',
  'order',
  'supplier',
  'employee',
  'purchase_order',
  'warehouse',
] as const

export interface CustomFieldPresetField {
  fieldKey: string
  label: string
  type: string
  options?: string[]
  defaultValue?: string
  formula?: string
  formulaType?: string
  sourceField?: string
  isRequired?: boolean
  showInTable?: boolean
  showInForm?: boolean
}

export interface CustomFieldPreset {
  label: string
  description: string
  fields: CustomFieldPresetField[]
}

/**
 * Industry-specific presets for product custom fields.
 * Applied via POST `?applyPreset=medical_products` (or hotel_products / tailor_products).
 */
export const CUSTOM_FIELD_PRESETS: Record<string, CustomFieldPreset> = {
  medical_products: {
    label: 'Medical / Pharmacy Products',
    description: 'Route, dosage form, strength, packaging, controlled-drug class',
    fields: [
      { fieldKey: 'route', label: 'Route of Administration', type: 'select', options: ['Oral', 'Topical', 'IV', 'IM', 'Subcutaneous', 'Inhalation', 'Sublingual', 'Rectal', 'Vaginal', 'Ophthalmic', 'Otic', 'Nasal'], showInTable: true, showInForm: true },
      { fieldKey: 'dosage_form', label: 'Dosage Form', type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Suppository', 'Patch', 'Powder'], showInTable: true, showInForm: true },
      { fieldKey: 'strength', label: 'Strength', type: 'text', showInTable: true, showInForm: true },
      { fieldKey: 'packaging', label: 'Packaging', type: 'text', showInTable: false, showInForm: true },
      { fieldKey: 'controlled_class', label: 'Controlled Drug Class', type: 'select', options: ['Non-controlled', 'Class A', 'Class B', 'Class C', 'Class D', 'Poison A', 'Poison B'], showInTable: false, showInForm: true },
      { fieldKey: 'generic_name', label: 'Generic Name', type: 'text', showInTable: true, showInForm: true },
      { fieldKey: 'manufacturer', label: 'Manufacturer', type: 'text', showInTable: false, showInForm: true },
      { fieldKey: 'storage', label: 'Storage Condition', type: 'select', options: ['Room Temperature', 'Refrigerate 2-8°C', 'Freeze', 'Protect from Light', 'Protect from Moisture'], showInTable: false, showInForm: true },
    ],
  },
  hotel_products: {
    label: 'Hotel / Hospitality Products',
    description: 'Service category, room type, meal plan, charge code',
    fields: [
      { fieldKey: 'service_category', label: 'Service Category', type: 'select', options: ['Room', 'F&B', 'Spa', 'Laundry', 'Concierge', 'Mini-bar', 'Event'], showInTable: true, showInForm: true },
      { fieldKey: 'room_type', label: 'Room Type', type: 'select', options: ['Standard', 'Deluxe', 'Suite', 'Family', 'Connecting', 'Penthouse'], showInTable: true, showInForm: true },
      { fieldKey: 'meal_plan', label: 'Meal Plan', type: 'select', options: ['Room Only', 'Breakfast', 'Half Board', 'Full Board', 'All Inclusive'], showInTable: false, showInForm: true },
      { fieldKey: 'charge_code', label: 'POS Charge Code', type: 'text', showInTable: false, showInForm: true },
      { fieldKey: 'taxable', label: 'Taxable', type: 'checkbox', defaultValue: 'true', showInTable: false, showInForm: true },
    ],
  },
  tailor_products: {
    label: 'Tailor / Fashion Products',
    description: 'Garment type, fabric, size range, care instructions',
    fields: [
      { fieldKey: 'garment_type', label: 'Garment Type', type: 'select', options: ['Shirt', 'Suit', 'Dress', 'Trousers', 'Kurung', 'Blouse', 'Skirt', 'Jacket', 'Coat'], showInTable: true, showInForm: true },
      { fieldKey: 'fabric', label: 'Fabric', type: 'text', showInTable: true, showInForm: true },
      { fieldKey: 'size_range', label: 'Size Range', type: 'select', options: ['XS-XL', 'XXS-XXL', 'Free Size', 'Made to Measure', 'S-XXXL'], showInTable: false, showInForm: true },
      { fieldKey: 'care_instructions', label: 'Care Instructions', type: 'textarea', showInTable: false, showInForm: true },
      { fieldKey: 'lead_time_days', label: 'Lead Time (days)', type: 'number', defaultValue: '7', showInTable: false, showInForm: true },
    ],
  },
}

// ============ Helpers ============

export function slugify(s: string): string {
  const out = (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return out || 'field'
}

function buildFieldData(input: any, tenantId: string, module: string) {
  const label = String(input.label || '').trim()
  if (!label) throw new Error('Label is required')
  const type = String(input.type || 'text')
  if (!FIELD_TYPES.includes(type as any)) throw new Error(`Invalid type: ${type}`)

  const formulaType = input.formulaType ? String(input.formulaType) : null
  if (formulaType && !FORMULA_TYPES.includes(formulaType as any)) {
    throw new Error(`Invalid formulaType: ${formulaType}`)
  }

  // Clear irrelevant config when type changes.
  const isCalculatedFamily = type === 'formula' || type === 'calculated'
  const options =
    type === 'select'
      ? Array.isArray(input.options)
        ? JSON.stringify(input.options.map(String))
        : input.options || null
      : null
  const formula = isCalculatedFamily ? (input.formula ? String(input.formula) : null) : null
  const sourceField = isCalculatedFamily ? (input.sourceField ? String(input.sourceField) : null) : null

  return {
    tenantId,
    module,
    fieldKey: String(input.fieldKey || slugify(label)),
    label,
    type,
    options: options as string | null,
    defaultValue: input.defaultValue != null ? String(input.defaultValue) : null,
    formula,
    formulaType,
    sourceField,
    isRequired: !!input.isRequired,
    isFilterable: !!input.isFilterable,
    showInTable: input.showInTable !== false,
    showInForm: input.showInForm !== false,
    sortOrder: parseInt(input.sortOrder) || 0,
    isActive: input.isActive !== false,
  }
}

// ============ Routes ============

// GET /api/erp/custom-fields?module=products
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const moduleFilter = searchParams.get('module') || undefined
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }
  const where: any = { ...filter }
  if (moduleFilter) where.module = moduleFilter

  const fields = await db.customField.findMany({
    where,
    orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  })

  return NextResponse.json({
    fields,
    modules: [...MODULES],
    fieldTypes: [...FIELD_TYPES],
    formulaTypes: [...FORMULA_TYPES],
    presets: Object.entries(CUSTOM_FIELD_PRESETS).map(([key, p]) => ({
      key,
      label: p.label,
      description: p.description,
      fieldCount: p.fields.length,
    })),
  })
}

// POST /api/erp/custom-fields  — create one field, or applyPreset=medical_products
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'inventory') && !canWrite(user.role, 'customers') && !canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const applyPreset = searchParams.get('applyPreset') || body.applyPreset
    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    // ---- Apply a preset (bulk-create several fields for the products module) ----
    if (applyPreset) {
      const preset = CUSTOM_FIELD_PRESETS[applyPreset]
      if (!preset) return NextResponse.json({ error: `Unknown preset: ${applyPreset}` }, { status: 400 })

      const created: any[] = []
      for (const f of preset.fields) {
        const data = buildFieldData({ ...f, module: 'product' }, tenantId, 'product')
        // Skip if a field with the same key already exists for this tenant+module.
        const existing = await db.customField.findUnique({
          where: { tenantId_module_fieldKey: { tenantId, module: 'product', fieldKey: data.fieldKey } },
        })
        if (existing) {
          created.push(existing)
          continue
        }
        const row = await db.customField.create({ data })
        created.push(row)
      }

      await logAction({
        ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
        action: 'create',
        entityType: 'custom_field',
        entityName: applyPreset,
        summary: `Applied custom-field preset "${applyPreset}" (${created.length} fields)`,
        metadata: { preset: applyPreset, count: created.length },
      })

      return NextResponse.json({ created, count: created.length, preset: applyPreset })
    }

    // ---- Single field create ----
    const moduleKey = String(body.module || '')
    if (!moduleKey) return NextResponse.json({ error: 'module is required' }, { status: 400 })

    const data = buildFieldData(body, tenantId, moduleKey)

    const existing = await db.customField.findUnique({
      where: { tenantId_module_fieldKey: { tenantId, module: moduleKey, fieldKey: data.fieldKey } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `A field with key "${data.fieldKey}" already exists for module "${moduleKey}"` },
        { status: 409 },
      )
    }

    const field = await db.customField.create({ data })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'custom_field',
      entityId: field.id,
      entityName: field.label,
      summary: `Created custom field "${field.label}" (${field.fieldKey}) on ${moduleKey}`,
      metadata: { module: moduleKey, fieldKey: field.fieldKey, type: field.type },
    })

    return NextResponse.json({ field })
  } catch (e: any) {
    console.error('Create custom field error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
