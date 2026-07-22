import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'hr')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  if (user.role !== 'OWNER' && employee.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.email !== undefined) updates.email = body.email.toLowerCase()
    if (body.department !== undefined) updates.department = body.department
    if (body.role !== undefined) updates.role = body.role
    if (body.salary !== undefined) updates.salary = parseFloat(body.salary)
    if (body.status !== undefined) updates.status = body.status
    if (body.hireDate !== undefined) updates.hireDate = new Date(body.hireDate)

    const updated = await db.employee.update({ where: { id }, data: updates })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: employee.tenantId },
      action: 'update', entityType: 'employee', entityId: id, entityName: updated.name,
      summary: `Updated employee "${updated.name}"`,
    })

    return NextResponse.json({ employee: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'hr')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { id } = await params

  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  if (user.role !== 'OWNER' && employee.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.employee.delete({ where: { id } })

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: employee.tenantId },
    action: 'delete', entityType: 'employee', entityId: id, entityName: employee.name,
    summary: `Deleted employee "${employee.name}"`,
  })

  return NextResponse.json({ ok: true })
}
