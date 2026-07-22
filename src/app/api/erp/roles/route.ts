import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'

// GET /api/erp/roles — list all roles for the tenant
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const roles = await db.role.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { users: true } } },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({ roles })
}

// POST /api/erp/roles — create a new custom role (admin only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'users')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, description, permissions } = body

    if (!name) return NextResponse.json({ error: 'Role name is required' }, { status: 400 })

    // Check for duplicate name
    const existing = await db.role.findFirst({ where: { tenantId: user.tenantId, name } })
    if (existing) return NextResponse.json({ error: 'A role with this name already exists' }, { status: 400 })

    const role = await db.role.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        permissions: JSON.stringify(permissions || {}),
        isSystem: false,
      },
    })

    return NextResponse.json({ role })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
