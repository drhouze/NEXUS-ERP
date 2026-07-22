import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

const TAB_MODULES = ['inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'accounting', 'reports']
const CONTENT_TYPES = ['notes', 'link_list', 'iframe', 'custom_fields']

// GET /api/erp/custom-tabs?module=inventory
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const modFilter = url.searchParams.get('module')
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const where: any = { tenantId, isActive: true }
  if (modFilter) where.module = modFilter

  const tabs = await db.customTab.findMany({
    where,
    orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
  })

  // Parse config JSON
  const parsed = tabs.map(t => ({ ...t, config: t.config ? JSON.parse(t.config) : null }))

  return NextResponse.json({ tabs: parsed, modules: TAB_MODULES, contentTypes: CONTENT_TYPES })
}

// POST — create custom tab
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { module, tabName, contentType, config } = await req.json()
    if (!module || !tabName || !contentType) return NextResponse.json({ error: 'Module, tab name, and content type required' }, { status: 400 })

    const tab = await db.customTab.create({
      data: {
        tenantId, module, tabName, contentType,
        config: config ? JSON.stringify(config) : null,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'custom_tab', entityId: tab.id, entityName: tab.tabName,
      summary: `Created custom tab "${tabName}" for ${module}`,
    })

    return NextResponse.json({ tab })
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

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.customTab.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
