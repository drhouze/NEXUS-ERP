import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * GET /api/erp/notes?entityType=X&entityId=Y
 * Returns { notes: [...] } for that entity.
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
  const notes = await db.recordNote.findMany({
    where: { ...tenantFilter, entityType, entityId },
    orderBy: { createdAt: 'desc' },
  })

  // The NotesPanel component reads either `n.authorName` or `n.author.name`.
  return NextResponse.json({
    notes: notes.map(n => ({
      ...n,
      author: { name: n.authorName },
    })),
  })
}

/**
 * POST /api/erp/notes
 * Body: { entityType, entityId, content, authorName? }
 * When authorName is omitted, the current user's name is used.
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
    const content = String(body.content || '').trim()
    if (!entityType || !entityId || !content) {
      return NextResponse.json({ error: 'entityType, entityId and content are required' }, { status: 400 })
    }

    const tenantId = user.role === 'OWNER' ? (body.targetTenantId || user.tenantId) : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    const authorName = body.authorName ? String(body.authorName) : user.name

    const note = await db.recordNote.create({
      data: {
        tenantId,
        entityType,
        entityId,
        authorId: user.id,
        authorName,
        content,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'record_note',
      entityId: note.id,
      summary: `Added note on ${entityType}#${entityId}`,
      metadata: { entityType, entityId, contentLength: content.length },
    })

    return NextResponse.json({
      note: { ...note, author: { name: note.authorName } },
    })
  } catch (e: any) {
    console.error('Create note error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
