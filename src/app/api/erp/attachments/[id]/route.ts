import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * GET /api/erp/attachments/[id]
 * Returns the full attachment including base64Data (used by the download button).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const att = await db.fileAttachment.findUnique({ where: { id } })
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && att.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // AttachmentsPanel reads either `d.data` or `d.attachment.data`.
  return NextResponse.json({
    attachment: {
      ...att,
      size: att.fileSize,
      data: att.base64Data,
    },
    data: att.base64Data,
  })
}

/**
 * DELETE /api/erp/attachments/[id]
 * Used by the AttachmentsPanel component (which doesn't pass ?id=).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers') && !canWrite(user.role, 'orders') && !canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const att = await db.fileAttachment.findUnique({ where: { id } })
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'OWNER' && att.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.fileAttachment.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: att.tenantId },
    action: 'delete',
    entityType: 'file_attachment',
    entityId: id,
    entityName: att.fileName,
    summary: `Deleted attachment "${att.fileName}"`,
  })

  return NextResponse.json({ ok: true })
}
