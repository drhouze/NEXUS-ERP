import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/workflows - list workflows + recent executions
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const workflows = await db.workflow.findMany({
    where: { tenantId },
    include: { steps: { orderBy: { order: 'asc' } }, _count: { select: { executions: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const recentExecutions = await db.workflowExecution.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { workflow: { select: { name: true } } },
  })

  return NextResponse.json({ workflows, recentExecutions })
}

// POST - create workflow
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { name, description, trigger, steps } = await req.json()
    if (!name || !trigger) return NextResponse.json({ error: 'Name and trigger required' }, { status: 400 })

    const workflow = await db.workflow.create({
      data: {
        tenantId, name, description: description || null, trigger,
        steps: {
          create: (steps || []).map((s: any, i: number) => ({
            order: i + 1,
            type: s.type,
            config: JSON.stringify(s.config || {}),
          })),
        },
      },
      include: { steps: true },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'workflow', entityId: workflow.id, entityName: workflow.name,
      summary: `Created workflow "${workflow.name}" (trigger: ${trigger}, ${steps?.length || 0} steps)`,
    })

    return NextResponse.json({ workflow })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH - toggle active/inactive
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { workflowId, isActive } = await req.json()
    await db.workflow.update({ where: { id: workflowId }, data: { isActive } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const url = new URL(req.url)
  const workflowId = url.searchParams.get('id')
  if (!workflowId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.workflow.delete({ where: { id: workflowId } })
  return NextResponse.json({ ok: true })
}
