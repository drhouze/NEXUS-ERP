import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'nexus-erp-dev-secret-change-in-prod'

export interface AppUser {
  id: string
  email: string
  name: string
  role: 'OWNER' | 'TENANT_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CUSTOM'
  tenantId: string
  impersonatedBy?: string | null
  portalType?: string  // 'staff' | 'supplier' | 'customer'
  modulePermissions?: string | null  // JSON array of allowed module keys
  customRoleId?: string | null  // linked Role record for custom roles
}

export interface SessionToken {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
}

export function createToken(user: AppUser): string {
  return jwt.sign(
    {
      id: user.id, email: user.email, name: user.name, role: user.role,
      tenantId: user.tenantId,
      portalType: (user as any).portalType || 'staff',
      modulePermissions: (user as any).modulePermissions || null,
      customRoleId: (user as any).customRoleId || null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): SessionToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionToken
  } catch {
    return null
  }
}

const COOKIE_NAME = 'nexus_session'

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await getTokenFromCookies()
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return payload as AppUser
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(...roles: string[]): Promise<AppUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) redirect('/')
  return user
}

// Permission helpers
export type Permission = 'view' | 'edit' | 'approve' | 'manage_users' | 'manage_tenant' | 'manage_platform'

const ROLE_PERMISSIONS: Record<string, Record<string, Permission[]>> = {
  OWNER: {
    owner: ['view', 'edit', 'manage_platform'],
    dashboard: ['view', 'edit'],
    inventory: ['view', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    purchasing: ['view', 'edit', 'approve'],
    hr: ['view', 'edit'],
    finance: ['view', 'edit'],
    reports: ['view'],
    userManagement: ['view', 'edit', 'manage_users'],
    tenantSettings: ['view', 'edit', 'manage_tenant'],
    auditLog: ['view'],
    backup: ['view', 'edit', 'manage_platform'],
  },
  TENANT_ADMIN: {
    owner: [],
    dashboard: ['view', 'edit'],
    inventory: ['view', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    purchasing: ['view', 'edit', 'approve'],
    hr: ['view', 'edit'],
    finance: ['view', 'edit'],
    reports: ['view'],
    userManagement: ['view', 'edit', 'manage_users'],
    tenantSettings: ['view', 'edit', 'manage_tenant'],
    auditLog: ['view'],
    backup: ['view', 'edit'],
  },
  MANAGER: {
    owner: [],
    dashboard: ['view', 'edit'],
    inventory: ['view', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    purchasing: ['view', 'edit', 'approve'],
    hr: ['view'],
    finance: ['view'],
    reports: ['view'],
    userManagement: ['view'],
    tenantSettings: ['view'],
    auditLog: [],
    backup: [],
  },
  EMPLOYEE: {
    owner: [],
    dashboard: ['view'],
    inventory: ['view'],
    orders: ['view', 'edit'],
    customers: ['view'],
    purchasing: ['view'],
    hr: [],
    finance: [],
    reports: ['view'],
    userManagement: [],
    tenantSettings: [],
    auditLog: [],
    backup: [],
  },
}

export function can(role: string, module: string, perm: Permission): boolean {
  return (ROLE_PERMISSIONS[role]?.[module] || []).includes(perm)
}

export function canAccess(role: string, module: string): boolean {
  const perms = ROLE_PERMISSIONS[role]?.[module] || []
  return perms.length > 0
}
