import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { computeAge, parseIcToBirthDate } from '@/lib/calculated-fields'

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

/**
 * Auto-extract dateOfBirth from a Malaysian IC number when the customer
 * provides an IC but no explicit DOB. Returns a Date or null.
 */
function maybeExtractDobFromIc(idType: any, idNumber: any, dateOfBirth: any): Date | null {
  if (dateOfBirth) return null // explicit DOB wins
  const type = String(idType || '').toUpperCase()
  if (type !== 'IC' && type !== 'NRIC') return null
  return parseIcToBirthDate(String(idNumber || ''))
}

function computeAgeFor(c: { dateOfBirth?: Date | string | null; idType?: string | null; idNumber?: string | null }): number | null {
  if (c.dateOfBirth) return computeAge(c.dateOfBirth as any)
  if (String(c.idType || '').toUpperCase() === 'IC' && c.idNumber) {
    const bd = parseIcToBirthDate(c.idNumber)
    return bd ? computeAge(bd) : null
  }
  return null
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const customers = await db.customer.findMany({
    where: filter,
    include: {
      orders: { select: { id: true, total: true, status: true, createdAt: true, orderNumber: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { totalSpent: 'desc' },
  })

  const statusCounts = await db.customer.groupBy({ by: ['status'], where: filter, _count: true })

  // ---- Computed fields + lifecycle counts ----
  const customersWithComputed = customers.map(c => ({
    ...c,
    tags: parseTags(c.tags),
    age: computeAgeFor(c),
  }))

  const lifecycleCounts: Record<string, number> = {}
  for (const c of customers) {
    const stage = (c as any).lifecycleStage || c.status || 'lead'
    lifecycleCounts[stage] = (lifecycleCounts[stage] || 0) + 1
  }

  return NextResponse.json({
    customers: customersWithComputed,
    statusCounts,
    lifecycleCounts,
    summary: {
      total: customers.length,
      active: customers.filter(c => c.status === 'active').length,
      leads: customers.filter(c => c.status === 'lead').length,
      inactive: customers.filter(c => c.status === 'inactive').length,
      totalSpent: customers.reduce((s, c) => s + c.totalSpent, 0),
      avgSpent: customers.length ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length : 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      name, email, phone, company, status,
      dateOfBirth, gender, idType, idNumber, nationality, occupation,
      lifecycleStage, leadSource, ownerId, tags, lastContactAt,
      targetTenantId,
    } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!name || !email || !company) {
      return NextResponse.json({ error: 'Name, email and company are required' }, { status: 400 })
    }

    const existing = await db.customer.findUnique({ where: { tenantId_email: { tenantId, email: email.toLowerCase() } } })
    if (existing) return NextResponse.json({ error: 'Email already exists in this tenant' }, { status: 400 })

    // ---- Auto-extract DOB from IC when no DOB was provided ----
    let dob: Date | null = dateOfBirth ? new Date(dateOfBirth) : null
    if (!dob) {
      const extracted = maybeExtractDobFromIc(idType, idNumber, dateOfBirth)
      if (extracted) dob = extracted
    }

    const customer = await db.customer.create({
      data: {
        tenantId,
        name,
        email: email.toLowerCase(),
        phone: phone || '',
        company,
        status: status || 'lead',
        dateOfBirth: dob,
        gender: gender || null,
        idType: idType || null,
        idNumber: idNumber || null,
        nationality: nationality || null,
        occupation: occupation || null,
        lifecycleStage: lifecycleStage || 'lead',
        leadSource: leadSource || null,
        ownerId: ownerId || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : (tags || null),
        lastContactAt: lastContactAt ? new Date(lastContactAt) : null,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'customer',
      entityId: customer.id,
      entityName: customer.company,
      summary: `Created customer "${customer.company}" (${customer.name})`,
      metadata: { email, status: customer.status, lifecycleStage: customer.lifecycleStage },
    })

    return NextResponse.json({
      customer: {
        ...customer,
        tags: parseTags(customer.tags),
        age: computeAgeFor(customer),
      },
    })
  } catch (e: any) {
    console.error('Create customer error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
