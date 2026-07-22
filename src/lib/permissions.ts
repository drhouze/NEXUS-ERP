import { getCurrentUser, AppUser } from './session'
import { NextResponse } from 'next/server'

// Returns the user and the tenantId to write to.
export async function getWriteContext(targetTenantId?: string): Promise<{
  user: AppUser
  tenantId: string
} | { error: ReturnType<typeof NextResponse.json> }> {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  if (user.role === 'OWNER') {
    if (!targetTenantId) {
      return { error: NextResponse.json({ error: 'Owner must specify targetTenantId' }, { status: 400 }) }
    }
    return { user, tenantId: targetTenantId }
  }

  return { user, tenantId: user.tenantId }
}

// ============ Dynamic Permission System ============
// Permissions are stored as JSON in the Role model: { "orders": ["view","edit"], "customers": ["view"], ... }
// System roles (OWNER, TENANT_ADMIN, MANAGER, EMPLOYEE) have hardcoded fallbacks.
// Custom roles (role === 'CUSTOM') read from the DB Role model's permissions field.

// System role fallbacks (used when no custom role is configured)
const SYSTEM_ROLE_MODULES: Record<string, string[]> = {
  OWNER: ['dashboard', 'inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'accounting', 'reports', 'reportBuilder', 'workflows', 'userManagement', 'auditLog', 'settings', 'owner', 'rewards'],
  TENANT_ADMIN: ['dashboard', 'inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'accounting', 'reports', 'reportBuilder', 'workflows', 'userManagement', 'auditLog', 'settings', 'rewards'],
  MANAGER: ['dashboard', 'inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'reports', 'rewards'],
  EMPLOYEE: ['dashboard', 'orders', 'customers', 'rewards'],
}

const SYSTEM_WRITE_MODULES: Record<string, string[]> = {
  OWNER: ['inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'users', 'tenants', 'backup', 'settings', 'rewards'],
  TENANT_ADMIN: ['inventory', 'orders', 'customers', 'purchasing', 'hr', 'finance', 'users', 'backup', 'settings', 'rewards'],
  MANAGER: ['inventory', 'orders', 'customers', 'purchasing'],
  EMPLOYEE: ['orders'],
}

/**
 * Get the list of modules a role can access.
 * For system roles: uses hardcoded fallback.
 * For custom roles: caller should pass the permissions from the DB.
 */
export function getRoleModules(role: string, customPermissions?: Record<string, string[]>): string[] {
  if (role === 'CUSTOM' && customPermissions) {
    return Object.keys(customPermissions).filter(k => (customPermissions[k] || []).length > 0)
  }
  return SYSTEM_ROLE_MODULES[role] || []
}

/**
 * Check if a role can write to a module.
 * For custom roles: checks if the module has 'edit' permission in the custom permissions.
 */
export function canWrite(role: string, module: string, customPermissions?: Record<string, string[]>): boolean {
  if (role === 'CUSTOM' && customPermissions) {
    const perms = customPermissions[module] || customPermissions[mapModuleKey(module)] || []
    return perms.includes('edit')
  }
  return (SYSTEM_WRITE_MODULES[role] || []).includes(module)
}

/**
 * Check if a role can access a module (view or edit).
 */
export function canAccessModule(role: string, module: string, customPermissions?: Record<string, string[]>): boolean {
  if (role === 'CUSTOM' && customPermissions) {
    const perms = customPermissions[module] || customPermissions[mapModuleKey(module)] || []
    return perms.length > 0
  }
  return (SYSTEM_ROLE_MODULES[role] || []).includes(module)
}

/** Map between nav item keys and permission module keys. */
function mapModuleKey(key: string): string {
  const map: Record<string, string> = {
    'userManagement': 'users',
    'settings': 'settings',
    'owner': 'owner',
  }
  return map[key] || key
}

// ============ All available modules (for the role editor UI) ============
export const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'View KPIs and recent activity' },
  { key: 'orders', label: 'Orders / Visits', description: 'Create and manage sales orders' },
  { key: 'customers', label: 'Customers / Patients', description: 'CRM and customer records' },
  { key: 'inventory', label: 'Inventory / Pharmacy', description: 'Products and stock management' },
  { key: 'purchasing', label: 'Purchasing', description: 'Suppliers and purchase orders' },
  { key: 'hr', label: 'HR', description: 'Employees and payroll' },
  { key: 'finance', label: 'Finance', description: 'Transactions and P&L' },
  { key: 'accounting', label: 'Accounting', description: 'Double-entry, trial balance' },
  { key: 'reports', label: 'Reports', description: 'Analytics and insights' },
  { key: 'reportBuilder', label: 'Report Builder', description: 'Custom report creation' },
  { key: 'workflows', label: 'Workflows', description: 'Automation rules' },
  { key: 'rewards', label: 'Rewards', description: 'Nex Coins and partner shops' },
  { key: 'userManagement', label: 'User Management', description: 'Manage users and roles' },
  { key: 'auditLog', label: 'Audit Log', description: 'View system activity log' },
  { key: 'settings', label: 'Settings', description: 'Tenant configuration' },
]

export const ALL_PERMISSIONS = ['view', 'edit'] as const
