import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let settings = await db.dataRetentionSetting.findUnique({ where: { tenantId } })
  if (!settings) {
    settings = await db.dataRetentionSetting.create({ data: { tenantId } })
  }

  return NextResponse.json({ settings })
}

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
    if (body.auditLogDays !== undefined) updates.auditLogDays = parseInt(body.auditLogDays)
    if (body.notificationDays !== undefined) updates.notificationDays = parseInt(body.notificationDays)
    if (body.emailLogDays !== undefined) updates.emailLogDays = parseInt(body.emailLogDays)
    if (body.autoArchive !== undefined) updates.autoArchive = body.autoArchive

    const settings = await db.dataRetentionSetting.upsert({
      where: { tenantId },
      create: { tenantId, ...updates },
      update: updates,
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'update', entityType: 'tenant', entityId: tenantId,
      summary: `Data retention settings updated (audit: ${settings.auditLogDays}d, notif: ${settings.notificationDays}d, email: ${settings.emailLogDays}d)`,
    })

    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/erp/retention - run cleanup now
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let settings = await db.dataRetentionSetting.findUnique({ where: { tenantId } })
  if (!settings) {
    settings = await db.dataRetentionSetting.create({ data: { tenantId } })
  }

  const now = new Date()
  const result = { auditLogs: 0, notifications: 0, emailLogs: 0 }

  // Delete old audit logs
  if (settings.auditLogDays > 0) {
    const cutoff = new Date(now.getTime() - settings.auditLogDays * 86400000)
    const deleted = await db.auditLog.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } })
    result.auditLogs = deleted.count
  }

  // Delete old notifications
  if (settings.notificationDays > 0) {
    const cutoff = new Date(now.getTime() - settings.notificationDays * 86400000)
    const deleted = await db.notification.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } })
    result.notifications = deleted.count
  }

  // Delete old email logs
  if (settings.emailLogDays > 0) {
    const cutoff = new Date(now.getTime() - settings.emailLogDays * 86400000)
    const deleted = await db.emailLog.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } })
    result.emailLogs = deleted.count
  }

  await db.dataRetentionSetting.update({ where: { tenantId }, data: { lastRunAt: now } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
    action: 'update', entityType: 'tenant', entityId: tenantId,
    summary: `Data retention cleanup ran: deleted ${result.auditLogs} audit logs, ${result.notifications} notifications, ${result.emailLogs} email logs`,
    metadata: result,
  })

  return NextResponse.json({ ok: true, deleted: result })
}
