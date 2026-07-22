import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const employees = await db.employee.findMany({
    where: filter,
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  })

  const departments = await db.employee.groupBy({ by: ['department'], where: filter, _count: true, _sum: { salary: true } })

  const totalPayroll = employees.reduce((s, e) => s + e.salary, 0)
  const avgSalary = employees.length ? totalPayroll / employees.length : 0

  return NextResponse.json({
    employees,
    departments,
    summary: {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      onLeave: employees.filter(e => e.status === 'on_leave').length,
      terminated: employees.filter(e => e.status === 'terminated').length,
      totalPayroll,
      avgSalary,
      departmentCount: departments.length,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'hr')) {
    return NextResponse.json({ error: 'Only tenant admins and owners can manage employees' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, department, role, salary, hireDate, status, targetTenantId } = body
    const tenantId = user.role === 'OWNER' ? targetTenantId : user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'No tenant specified' }, { status: 400 })

    if (!name || !email || !department || !role || salary == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const employee = await db.employee.create({
      data: {
        tenantId, name, email: email.toLowerCase(), department, role,
        salary: parseFloat(salary),
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        status: status || 'active',
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create',
      entityType: 'employee',
      entityId: employee.id,
      entityName: employee.name,
      summary: `Onboarded employee "${employee.name}" (${employee.department})`,
    })

    return NextResponse.json({ employee })
  } catch (e: any) {
    console.error('Create employee error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
