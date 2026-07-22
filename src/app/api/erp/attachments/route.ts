import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * GET /api/erp/attachments?entityType=X&entityId=Y
 * Returns metadata only (no base64Data — too big for list views).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
  }

  const tenantFilter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }
  // The AttachmentsPanel reads `a.size` — expose it as both `fileSize` (DB) and `size` (alias).
  const rows = await db.fileAttachment.findMany({
    where: { ...tenantFilter, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      entityType: true,
      entityId: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      uploadedBy: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    attachments: rows.map(r => ({ ...r, size: r.fileSize })),
  })
}

/**
 * POST /api/erp/attachments
 *
 * Accepts BOTH the task spec shape and the AttachmentsPanel shape:
 *   { entityType, entityId, fileName, fileSize, mimeType, base64Data }   (task spec)
 *   { entityType, entityId, fileName, size, mimeType, data }             (component)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers') && !canWrite(user.role, 'orders') && !canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const entityType = String(body.entityType || '')
    const entityId = String(body.entityId || '')
    const fileName = String(body.fileName || '')
    const mimeType = String(body.mimeType || 'application/octet-stream')
    const base64Data = String(body.base64Data || body.data || '')
    const fileSize = Number(body.fileSize ?? body.size ?? 0) || base64Data.length

    if (!entityType || !entityId || !fileName || !base64Data) {
      return NextResponse.json(
        { error: 'entityType, entityId, fileName and base64Data (or data) are required' },
        { status: 400 },
      )
    }

    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    const att = await db.fileAttachment.create({
      data: {
        tenantId,
        entityType,
        entityId,
        fileName,
        fileSize,
        mimeType,
        base64Data,
        uploadedBy: user.name,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'file_attachment',
      entityId: att.id,
      entityName: fileName,
      summary: `Uploaded attachment "${fileName}" (${fileSize} bytes) on ${entityType}#${entityId}`,
      metadata: { entityType, entityId, fileName, fileSize, mimeType },
    })

    return NextResponse.json({
      attachment: {
        id: att.id,
        fileName: att.fileName,
        fileSize: att.fileSize,
        size: att.fileSize,
        mimeType: att.mimeType,
        createdAt: att.createdAt,
      },
    })
  } catch (e: any) {
    console.error('Upload attachment error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/erp/attachments?id=X
 *
 * (The AttachmentsPanel component uses DELETE /api/erp/attachments/[id]
 *  instead — that route lives in [id]/route.ts and shares this logic.)
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'customers') && !canWrite(user.role, 'orders') && !canWrite(user.role, 'inventory')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

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
  } catch (e: any) {
    console.error('Delete attachment error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
