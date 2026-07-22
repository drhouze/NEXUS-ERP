import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/audit-log - list audit logs (filtered by tenant for non-owners)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetTenantId = url.searchParams.get('tenantId')
  const action = url.searchParams.get('action')
  const entityType = url.searchParams.get('entityType')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  // OWNER: can see all logs or filter by tenant. TENANT_ADMIN: only own tenant.
  const where: any = {}
  if (user.role === 'OWNER' && targetTenantId) {
    where.OR = [{ tenantId: targetTenantId }, { tenantId: null, entityType: 'tenant', entityId: targetTenantId }]
  } else if (user.role !== 'OWNER') {
    where.tenantId = user.tenantId
  }
  if (action) where.action = action
  if (entityType) where.entityType = entityType

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ logs, count: logs.length })
}
