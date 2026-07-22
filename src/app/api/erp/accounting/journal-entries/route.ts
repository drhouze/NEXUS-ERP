import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { postJournalEntry } from '@/lib/accounting'
import { logAction } from '@/lib/audit'

// GET /api/erp/accounting/journal-entries - list journal entries
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const entries = await db.journalEntry.findMany({
    where: { tenantId },
    orderBy: { date: 'desc' },
    take: 100,
    include: { lines: { include: { account: true } } },
  })

  return NextResponse.json({ entries })
}

// POST /api/erp/accounting/journal-entries - create manual journal entry
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { description, date, lines } = await req.json()

    // Ensure chart of accounts exists
    const { seedChartOfAccounts } = await import('@/lib/accounting')
    await seedChartOfAccounts(tenantId)

    const result = await postJournalEntry({
      tenantId,
      description,
      refType: 'manual',
      lines,
    })

    // Update the date if provided
    if (date) {
      await db.journalEntry.update({ where: { id: result.entryId }, data: { date: new Date(date) } })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'transaction', entityId: result.entryId, entityName: result.entryNumber,
      summary: `Posted journal entry ${result.entryNumber}: ${description}`,
    })

    return NextResponse.json({ ok: true, entryNumber: result.entryNumber })
  } catch (e: any) {
    console.error('Journal entry error:', e?.message)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
