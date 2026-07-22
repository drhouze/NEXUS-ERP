import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { parseIcToBirthDate, computeAge } from '@/lib/calculated-fields'

function parseTags(t: any): string[] {
  if (!t) return []
  if (Array.isArray(t)) return t.map(String)
  try {
    const p = JSON.parse(t)
    return Array.isArray(p) ? p.map(String) : []
  } catch {
    return String(t).split(',').map(s => s.trim()).filter(Boolean)
  }
}

function computeAgeFor(c: { dateOfBirth?: Date | string | null; idType?: string | null; idNumber?: string | null }): number | null {
  if (c.dateOfBirth) return computeAge(c.dateOfBirth as any)
  if (String(c.idType || '').toUpperCase() === 'IC' && c.idNumber) {
    const bd = parseIcToBirthDate(c.idNumber)
    return bd ? computeAge(bd) : null
  }
  return null
}

/**
 * Auto-extract DOB from a Malaysian IC when the customer provides an IC
 * but no explicit DOB. Returns a Date (only when DOB was missing AND
 * extraction succeeded) or null.
 */
function maybeExtractDobFromIc(idType: any, idNumber: any, dateOfBirth: any): Date | null {
  if (dateOfBirth) return null
  const type = String(idType || '').toUpperCase()
  if (type !== 'IC' && type !== 'NRIC') return null
  return parseIcToBirthDate(String(idNumber || ''))
}

// GET /api/erp/customers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      orders: { select: { id: true, total: true, status: true, createdAt: true, orderNumber: true }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && customer.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    customer: {
      ...customer,
      tags: parseTags(customer.tags),
      age: computeAgeFor(customer),
    },
  })
}

// PATCH /api/erp/customers/[id] — accept all CRM fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.customer.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      name, email, phone, company, status,
      dateOfBirth, gender, idType, idNumber, nationality, occupation,
      lifecycleStage, leadSource, ownerId, tags, lastContactAt,
    } = body

    const patch: any = {}
    if (name !== undefined) patch.name = String(name)
    if (email !== undefined) patch.email = String(email).toLowerCase()
    if (phone !== undefined) patch.phone = String(phone || '')
    if (company !== undefined) patch.company = String(company)
    if (status !== undefined) patch.status = String(status)
    if (gender !== undefined) patch.gender = gender || null
    if (idType !== undefined) patch.idType = idType || null
    if (idNumber !== undefined) patch.idNumber = idNumber || null
    if (nationality !== undefined) patch.nationality = nationality || null
    if (occupation !== undefined) patch.occupation = occupation || null
    if (lifecycleStage !== undefined) patch.lifecycleStage = lifecycleStage || null
    if (leadSource !== undefined) patch.leadSource = leadSource || null
    if (ownerId !== undefined) patch.ownerId = ownerId || null
    if (tags !== undefined) {
      patch.tags = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null)
    }
    if (lastContactAt !== undefined) {
      patch.lastContactAt = lastContactAt ? new Date(lastContactAt) : null
    }

    // ---- DOB + IC auto-extraction ----
    if (dateOfBirth !== undefined) {
      patch.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
    }
    // If IC was provided/changed and DOB is still missing, try to extract.
    const effectiveDob = patch.dateOfBirth !== undefined ? patch.dateOfBirth : existing.dateOfBirth
    const effectiveIdType = patch.idType !== undefined ? patch.idType : existing.idType
    const effectiveIdNumber = patch.idNumber !== undefined ? patch.idNumber : existing.idNumber
    if (!effectiveDob) {
      const extracted = maybeExtractDobFromIc(effectiveIdType, effectiveIdNumber, effectiveDob)
      if (extracted) patch.dateOfBirth = extracted
    }

    // Email uniqueness check (if changing)
    if (patch.email && patch.email !== existing.email) {
      const clash = await db.customer.findUnique({
        where: { tenantId_email: { tenantId: existing.tenantId, email: patch.email } },
      })
      if (clash) return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const updated = await db.customer.update({ where: { id }, data: patch })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
      action: 'update',
      entityType: 'customer',
      entityId: id,
      entityName: updated.company,
      summary: `Updated customer "${updated.company}" (${updated.name})`,
      metadata: { changes: Object.keys(patch) },
    })

    return NextResponse.json({
      customer: {
        ...updated,
        tags: parseTags(updated.tags),
        age: computeAgeFor(updated),
      },
    })
  } catch (e: any) {
    console.error('Update customer error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

// DELETE /api/erp/customers/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.customer.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.customer.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: existing.tenantId },
    action: 'delete',
    entityType: 'customer',
    entityId: id,
    entityName: existing.company,
    summary: `Deleted customer "${existing.company}" (${existing.name})`,
  })

  return NextResponse.json({ ok: true })
}
