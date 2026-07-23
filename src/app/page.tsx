import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ErpShell } from '@/components/erp/shell'

export default async function Home() {
  try {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    // Check if this user is being impersonated
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { impersonatedBy: true, twoFactorEnabled: true, customRoleId: true, modulePermissions: true, portalType: true },
    })
    const isImpersonating = !!dbUser?.impersonatedBy
    const ownerInfo = isImpersonating && dbUser?.impersonatedBy
      ? await db.user.findUnique({ where: { id: dbUser.impersonatedBy }, select: { email: true, name: true } })
      : null

    // Load custom role permissions if the user has a custom role
    let rolePermissions: Record<string, string[]> | null = null
    const customRoleId = dbUser?.customRoleId || (user as any).customRoleId
    if (customRoleId) {
      const role = await db.role.findUnique({ where: { id: customRoleId }, select: { permissions: true, name: true } })
      if (role?.permissions) {
        try {
          rolePermissions = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
        } catch (e) {
          console.error('Failed to parse role.permissions for customRoleId', customRoleId, e)
        }
      }
    }

    // For OWNER: load tenants
    let tenants: any[] = []
    let currentTenant: any = null
    if (user.role === 'OWNER') {
      tenants = await db.tenant.findMany({
        include: {
          _count: { select: { users: true, products: true, customers: true, salesOrders: true } },
          users: { where: { role: 'TENANT_ADMIN' }, select: { id: true, email: true, name: true, role: true, status: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      })
    } else if (user.tenantId) {
      currentTenant = await db.tenant.findUnique({ where: { id: user.tenantId } })
    }

    // Load tenant users for user management
    let tenantUsers: any[] = []
    if (user.role === 'TENANT_ADMIN' && user.tenantId) {
      tenantUsers = await db.user.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true, status: true, emailVerified: true, lastLoginAt: true, createdAt: true, tenantId: true, customRoleId: true, portalType: true, modulePermissions: true, points: true },
      })
    }

    // Merge user info with DB fields
    const userWithExtras = {
      ...user,
      portalType: dbUser?.portalType || 'staff',
      modulePermissions: dbUser?.modulePermissions || null,
      customRoleId: dbUser?.customRoleId || null,
    }

    return (
      <ErpShell
        user={userWithExtras}
        tenants={tenants}
        currentTenant={currentTenant}
        tenantUsers={tenantUsers}
        isImpersonating={isImpersonating}
        ownerInfo={ownerInfo}
        rolePermissions={rolePermissions}
      />
    )
  } catch (e: any) {
    console.error('Home render error:', e)
    // If DEBUG_API_ERRORS is enabled, show the error details in the page response to help debugging.
    if (process.env.DEBUG_API_ERRORS === 'true') {
      return <pre style={{ whiteSpace: 'pre-wrap', padding: '1rem' }}>Home render error:\n{String(e.stack || e.message || e)}</pre>
    }
    throw e
  }
}
