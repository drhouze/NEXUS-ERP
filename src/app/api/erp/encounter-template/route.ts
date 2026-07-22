import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

// ============ Industry presets ============

export interface EncounterSection {
  id: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  label: string
  options?: string[]
  required?: boolean
  showOnInvoice?: boolean
  halfWidth?: boolean
}
export interface EncounterTableColumn {
  id: string
  type: 'text' | 'number' | 'select' | 'product'
  label: string
  options?: string[]
}
export interface EncounterItemTable {
  id: string
  name: string
  columns: EncounterTableColumn[]
}
export interface EncounterPresetData {
  displayName: string
  sections: EncounterSection[]
  itemTables: EncounterItemTable[]
  showAdvice: boolean
  adviceLabel: string
  showFollowUp: boolean
  followUpLabel: string
  showOnInvoice: boolean
  requireEncounterBeforeInvoice: boolean
  requiredSectionIds: string[]
  defaultDepositAmount: number | null
  defaultDepositLabel: string
}
export interface EncounterPreset {
  label: string
  badge: string
  data: Partial<EncounterPresetData>
}

export const ENCOUNTER_PRESETS: Record<string, EncounterPreset> = {
  medical: {
    label: 'Medical / Clinic',
    badge: 'Recommended for healthcare, dental, TCM clinics',
    data: {
      displayName: 'Clinical Encounter',
      sections: [
        { id: 'symptoms', type: 'textarea', label: 'Symptoms / Complaints', required: true, showOnInvoice: true },
        { id: 'vitals', type: 'text', label: 'Vitals (BP/HR/Temp)', halfWidth: true },
        { id: 'diagnosis', type: 'textarea', label: 'Diagnosis', required: true, showOnInvoice: true },
        { id: 'plan', type: 'textarea', label: 'Treatment Plan', showOnInvoice: true },
      ],
      itemTables: [
        {
          id: 'rx',
          name: 'Prescription',
          columns: [
            { id: 'drug', type: 'product', label: 'Medication' },
            { id: 'qty', type: 'number', label: 'Qty' },
            { id: 'sig', type: 'text', label: 'Sig (Instructions)' },
          ],
        },
      ],
      showAdvice: true,
      adviceLabel: 'Advice / Patient Education',
      showFollowUp: true,
      followUpLabel: 'Follow-up',
    },
  },
  hotel: {
    label: 'Hotel / Hospitality',
    badge: 'Recommended for hotels, spas, salons',
    data: {
      displayName: 'Guest Service Form',
      sections: [
        { id: 'room', type: 'text', label: 'Room #', halfWidth: true, required: true },
        { id: 'service', type: 'select', label: 'Service Type', options: ['Room Service', 'Spa', 'Laundry', 'Concierge'], halfWidth: true },
        { id: 'requests', type: 'textarea', label: 'Special Requests' },
      ],
      itemTables: [
        {
          id: 'charges',
          name: 'Additional Charges',
          columns: [
            { id: 'item', type: 'product', label: 'Item' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: false,
      showFollowUp: false,
    },
  },
  tailor: {
    label: 'Tailor / Fashion',
    badge: 'Recommended for tailors, boutiques',
    data: {
      displayName: 'Measurement & Order Form',
      sections: [
        { id: 'garment', type: 'select', label: 'Garment Type', options: ['Shirt', 'Suit', 'Dress', 'Trousers', 'Kurung'], required: true, halfWidth: true },
        { id: 'fabric', type: 'text', label: 'Fabric', halfWidth: true },
        { id: 'measurements', type: 'textarea', label: 'Measurements', required: true, showOnInvoice: true },
        { id: 'notes', type: 'textarea', label: 'Style Notes' },
      ],
      itemTables: [
        {
          id: 'items',
          name: 'Line Items',
          columns: [
            { id: 'item', type: 'product', label: 'Item' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: true,
      adviceLabel: 'Care Instructions',
      showFollowUp: true,
      followUpLabel: 'Fitting Appointment',
    },
  },
  trading: {
    label: 'Trading / Retail',
    badge: 'Recommended for retail, wholesale, F&B',
    data: {
      displayName: 'Order Form',
      sections: [{ id: 'notes', type: 'textarea', label: 'Order Notes' }],
      itemTables: [
        {
          id: 'items',
          name: 'Items',
          columns: [
            { id: 'item', type: 'product', label: 'Product' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: false,
      showFollowUp: false,
    },
  },
  blank: {
    label: 'Blank (Start from scratch)',
    badge: 'Build your own form',
    data: { displayName: 'Service Form', sections: [], itemTables: [] },
  },
}

// ============ Helpers ============

async function getOrCreateTemplate(tenantId: string) {
  let tpl = await db.encounterTemplate.findUnique({ where: { tenantId } })
  if (!tpl) {
    tpl = await db.encounterTemplate.create({ data: { tenantId } })
  }
  return tpl
}

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

// ============ Routes ============

// GET /api/erp/encounter-template
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const tpl = await getOrCreateTemplate(user.tenantId)

  // Return parsed JSON for sections / itemTables / requiredSectionIds so the
  // frontend doesn't have to JSON.parse every time.
  return NextResponse.json({
    template: {
      ...tpl,
      sections: parseArr(tpl.sections),
      itemTables: parseArr(tpl.itemTables),
      requiredSectionIds: parseArr(tpl.requiredSectionIds),
    },
    presets: Object.entries(ENCOUNTER_PRESETS).map(([key, p]) => ({
      key,
      label: p.label,
      badge: p.badge,
    })),
  })
}

// PATCH /api/erp/encounter-template
// Body: either { applyPreset: 'medical' } OR any subset of the template fields.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const existing = await getOrCreateTemplate(user.tenantId)

    // ---- Apply preset ----
    if (body.applyPreset) {
      const preset = ENCOUNTER_PRESETS[body.applyPreset]
      if (!preset) return NextResponse.json({ error: `Unknown preset: ${body.applyPreset}` }, { status: 400 })

      const data = preset.data
      const sections = data.sections || []
      const itemTables = (data.itemTables || []).map(t => ({
        ...t,
        columns: t.columns || [],
      }))

      const updated = await db.encounterTemplate.update({
        where: { tenantId: user.tenantId },
        data: {
          displayName: data.displayName || existing.displayName,
          sections: JSON.stringify(sections),
          itemTables: JSON.stringify(itemTables),
          showAdvice: data.showAdvice ?? existing.showAdvice,
          adviceLabel: data.adviceLabel ?? existing.adviceLabel,
          showFollowUp: data.showFollowUp ?? existing.showFollowUp,
          followUpLabel: data.followUpLabel ?? existing.followUpLabel,
          showOnInvoice: data.showOnInvoice ?? existing.showOnInvoice,
          requireEncounterBeforeInvoice: data.requireEncounterBeforeInvoice ?? existing.requireEncounterBeforeInvoice,
          requiredSectionIds: JSON.stringify([]),
          defaultDepositAmount: data.defaultDepositAmount ?? existing.defaultDepositAmount,
          defaultDepositLabel: data.defaultDepositLabel ?? existing.defaultDepositLabel,
        },
      })

      await logAction({
        ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
        action: 'update',
        entityType: 'encounter_template',
        entityId: updated.id,
        summary: `Applied encounter preset "${body.applyPreset}"`,
        metadata: { preset: body.applyPreset },
      })

      return NextResponse.json({
        template: {
          ...updated,
          sections: parseArr(updated.sections),
          itemTables: parseArr(updated.itemTables),
          requiredSectionIds: parseArr(updated.requiredSectionIds),
        },
      })
    }

    // ---- Inline update ----
    const patch: any = {}
    if (body.displayName !== undefined) patch.displayName = String(body.displayName)
    if (body.sections !== undefined) {
      patch.sections = Array.isArray(body.sections) ? JSON.stringify(body.sections) : String(body.sections)
    }
    if (body.itemTables !== undefined) {
      patch.itemTables = Array.isArray(body.itemTables) ? JSON.stringify(body.itemTables) : String(body.itemTables)
    }
    if (body.showAdvice !== undefined) patch.showAdvice = !!body.showAdvice
    if (body.adviceLabel !== undefined) patch.adviceLabel = String(body.adviceLabel)
    if (body.showFollowUp !== undefined) patch.showFollowUp = !!body.showFollowUp
    if (body.followUpLabel !== undefined) patch.followUpLabel = String(body.followUpLabel)
    if (body.showOnInvoice !== undefined) patch.showOnInvoice = !!body.showOnInvoice
    if (body.requireEncounterBeforeInvoice !== undefined) patch.requireEncounterBeforeInvoice = !!body.requireEncounterBeforeInvoice
    if (body.requiredSectionIds !== undefined) {
      patch.requiredSectionIds = Array.isArray(body.requiredSectionIds)
        ? JSON.stringify(body.requiredSectionIds)
        : String(body.requiredSectionIds)
    }
    if (body.defaultDepositAmount !== undefined) {
      patch.defaultDepositAmount = body.defaultDepositAmount == null ? null : Number(body.defaultDepositAmount)
    }
    if (body.defaultDepositLabel !== undefined) patch.defaultDepositLabel = String(body.defaultDepositLabel)

    const updated = await db.encounterTemplate.update({ where: { tenantId: user.tenantId }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'update',
      entityType: 'encounter_template',
      entityId: updated.id,
      summary: `Updated encounter template`,
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({
      template: {
        ...updated,
        sections: parseArr(updated.sections),
        itemTables: parseArr(updated.itemTables),
        requiredSectionIds: parseArr(updated.requiredSectionIds),
      },
    })
  } catch (e: any) {
    console.error('Update encounter template error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
