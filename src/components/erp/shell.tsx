'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Users as UsersIcon, Truck, UserCog,
  Wallet, BarChart3, Search, Bell, Settings as SettingsIcon, Menu, X, ChevronRight,
  Building2, Crown, Shield, UserCheck, User as UserIcon, Globe, Server, ScrollText, Calculator,
  Workflow as WorkflowIcon, Database, Gift,
} from 'lucide-react'
import { DashboardModule } from './dashboard'
import { InventoryModule } from './inventory'
import { OrdersModule } from './orders'
import { ProfileDialog } from './profile-dialog'
import { RewardsModule } from './rewards'
import { CustomersModule } from './customers'
import { PurchasingModule } from './purchasing'
import { HRModule } from './hr'
import { FinanceModule } from './finance'
import { ReportsModule } from './reports'
import { OwnerConsole } from './owner-console'
import { UserManagement } from './user-management'
import { AuditLogModule } from './audit-log'
import { SettingsModule } from './settings'
import { NotificationsBell } from './notifications-bell'
import { AccountingModule } from './accounting'
import { WorkflowModule } from './workflow'
import { ReportBuilderModule } from './report-builder'
import { setBaseCurrency } from './lib'

type ModuleKey =
  | 'dashboard' | 'inventory' | 'orders' | 'customers' | 'purchasing'
  | 'hr' | 'finance' | 'accounting' | 'reports' | 'reportBuilder' | 'owner' | 'users' | 'auditLog' | 'settings' | 'workflows'

interface NavItem {
  key: ModuleKey
  label: string
  icon: typeof LayoutDashboard
  description: string
  group: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  // Owner-only
  { key: 'owner', label: 'Owner Console', icon: Crown, description: 'Tenants & platform metrics', group: 'Platform', roles: ['OWNER'] },

  // Overview
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs & activity overview', group: 'Overview', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },

  // Operations
  { key: 'inventory', label: 'Inventory', icon: Package, description: 'Products & stock levels', group: 'Operations', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },
  { key: 'orders', label: 'Sales Orders', icon: ShoppingCart, description: 'Order pipeline & revenue', group: 'Operations', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },
  { key: 'customers', label: 'Customers', icon: UsersIcon, description: 'CRM & lifetime value', group: 'Operations', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },
  { key: 'purchasing', label: 'Purchasing', icon: Truck, description: 'Suppliers & purchase orders', group: 'Operations', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },

  // People
  { key: 'hr', label: 'HR', icon: UserCog, description: 'Employees & payroll', group: 'People', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'CUSTOM'] },
  { key: 'rewards', label: 'Rewards', icon: Gift, description: 'Points & rewards shop', group: 'People', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },
  { key: 'finance', label: 'Finance', icon: Wallet, description: 'Transactions & P&L', group: 'People', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'CUSTOM'] },
  { key: 'accounting', label: 'Accounting', icon: Calculator, description: 'Double-entry, trial balance, P&L', group: 'People', roles: ['OWNER', 'TENANT_ADMIN', 'CUSTOM'] },

  // Insights
  { key: 'reports', label: 'Reports', icon: BarChart3, description: 'Analytics & insights', group: 'Insights', roles: ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOM'] },
  { key: 'reportBuilder', label: 'Report Builder', icon: Database, description: 'Custom reports + CSV export', group: 'Insights', roles: ['OWNER', 'TENANT_ADMIN', 'CUSTOM'] },
  { key: 'workflows', label: 'Workflows', icon: WorkflowIcon, description: 'Automate business processes', group: 'Insights', roles: ['OWNER', 'TENANT_ADMIN', 'CUSTOM'] },

  // Administration
  { key: 'users', label: 'User Management', icon: Shield, description: 'Employees & roles', group: 'Administration', roles: ['TENANT_ADMIN', 'OWNER'] },
  { key: 'auditLog', label: 'Audit Log', icon: ScrollText, description: 'Compliance & activity trail', group: 'Administration', roles: ['OWNER', 'TENANT_ADMIN', 'CUSTOM'] },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, description: 'Plan, backup, profile', group: 'Administration', roles: ['TENANT_ADMIN', 'OWNER'] },
]

const ROLE_META: Record<string, { label: string; icon: any; color: string }> = {
  OWNER: { label: 'Platform Owner', icon: Crown, color: 'bg-amber-100 text-amber-700' },
  TENANT_ADMIN: { label: 'Tenant Admin', icon: Shield, color: 'bg-indigo-100 text-indigo-700' },
  MANAGER: { label: 'Manager', icon: UserCheck, color: 'bg-emerald-100 text-emerald-700' },
  EMPLOYEE: { label: 'Employee', icon: UserIcon, color: 'bg-slate-100 text-slate-700' },
}

interface ErpShellProps {
  user: { id: string; email: string; name: string; role: string; tenantId: string; portalType?: string; modulePermissions?: string | null; customRoleId?: string | null }
  tenants: any[]
  currentTenant: any
  tenantUsers: any[]
  isImpersonating?: boolean
  ownerInfo?: { email: string; name: string } | null
  rolePermissions?: Record<string, string[]> | null
}

export function ErpShell({ user, tenants, currentTenant, tenantUsers, isImpersonating, ownerInfo, rolePermissions }: ErpShellProps) {
  const router = useRouter()
  // Pick default module by role
  const defaultModule: ModuleKey = user.role === 'OWNER' ? 'owner' : 'dashboard'
  const [active, setActive] = useState<ModuleKey>(defaultModule)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // Bumped every time the base currency is (re)loaded so the entire content
  // tree re-renders with the new symbol from `formatCurrency`.
  const [currencySymbolVersion, setCurrencySymbolVersion] = useState(0)
  // Module label overrides fetched from /api/erp/module-labels.
  const [moduleLabels, setModuleLabels] = useState<Record<string, { label: string; description?: string }>>({})

  // ---- Fetch the tenant's base currency on mount + apply it globally ----
  // Skipped for OWNER (no tenant) — defaults remain ($/USD).
  useEffect(() => {
    if (user.role === 'OWNER' || !user.tenantId) return
    let cancelled = false
    fetch('/api/erp/currencies')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d?.currencies) return
        const base = d.currencies.find((c: any) => c.isBase)
        if (base) {
          setBaseCurrency(base.code, base.symbol || '$')
          // Force a re-render so all `formatCurrency` calls pick up the new symbol.
          setCurrencySymbolVersion(v => v + 1)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user.role, user.tenantId])

  // ---- Fetch module label overrides ----
  useEffect(() => {
    let cancelled = false
    fetch('/api/erp/module-labels')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d?.map) return
        setModuleLabels(d.map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Parse per-user module permissions (if set, restrict to only those modules)
  const userModulePerms: string[] | null = (() => {
    try {
      const raw = (user as any).modulePermissions
      if (!raw) return null
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr : null
    } catch { return null }
  })()

  // For custom roles: use rolePermissions from the DB Role model
  // For system roles: use the hardcoded NAV_ITEMS roles list
  const allowedModules: Set<string> | null = (() => {
    if (rolePermissions) {
      return new Set(Object.keys(rolePermissions).filter(k => (rolePermissions[k] || []).length > 0))
    }
    return null
  })()

  // Filter nav items by role + per-user module permissions + custom role permissions
  const visibleItems = NAV_ITEMS.filter(item => {
    // System role check (OWNER, TENANT_ADMIN, MANAGER, EMPLOYEE)
    const isSystemRole = ['OWNER', 'TENANT_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role)
    if (isSystemRole) {
      if (!item.roles.includes(user.role)) return false
    }
    // For custom roles: check against rolePermissions
    if (allowedModules && !['dashboard', 'settings', 'owner'].includes(item.key)) {
      if (!allowedModules.has(item.key)) return false
    }
    // Per-user module permissions override (highest priority)
    if (userModulePerms && !['dashboard', 'settings', 'owner'].includes(item.key)) {
      return userModulePerms.includes(item.key)
    }
    return true
  })
  const groups = Array.from(new Set(visibleItems.map(i => i.group)))
  const activeItem = visibleItems.find(n => n.key === active) || visibleItems[0]

  // Resolve a nav item's label/description through the module-labels override map.
  function resolveLabel(item: NavItem) {
    const m = moduleLabels[item.key]
    return {
      label: m?.label || item.label,
      description: m?.description || item.description,
    }
  }

  const RoleIcon = ROLE_META[user.role].icon

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 border-r border-border/60 bg-sidebar transition-transform duration-200 flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            N
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground leading-tight truncate">Nexus ERP</h1>
            <p className="text-xs text-muted-foreground truncate">
              {user.role === 'OWNER' ? 'Platform Console' : currentTenant?.name || 'Enterprise Suite'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden -mr-2 shrink-0" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {groups.map(group => {
            const items = visibleItems.filter(n => n.group === group)
            if (items.length === 0) return null
            return (
              <div key={group}>
                <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{group}</p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon
                    const isActive = active === item.key
                    const resolved = resolveLabel(item)
                    return (
                      <button
                        key={item.key}
                        onClick={() => { setActive(item.key); setMobileOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left">{resolved.label}</span>
                        {isActive && <ChevronRight className="h-4 w-4" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-border/60 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={cn('text-xs font-semibold', ROLE_META[user.role].color)}>
                {user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <RoleIcon className="h-3 w-3" />
                {ROLE_META[user.role].label}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>
                <strong>Impersonating:</strong> You are signed in as {user.name} ({user.email}) — {currentTenant?.name || 'tenant'}
                {ownerInfo && <span className="opacity-80 ml-2">· Started by {ownerInfo.email}</span>}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 bg-white text-amber-700 hover:bg-white/90"
              onClick={async () => {
                await fetch('/api/erp/impersonate', { method: 'DELETE' })
                router.push('/')
                router.refresh()
              }}
            >
              End Impersonation
            </Button>
          </div>
        )}
        <header className="sticky top-0 z-20 h-16 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="h-full flex items-center gap-3 px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground truncate">{activeItem ? resolveLabel(activeItem).label : ''}</h2>
                <Badge variant="secondary" className="hidden sm:inline-flex text-xs font-normal">
                  {activeItem ? resolveLabel(activeItem).description : ''}
                </Badge>
              </div>
            </div>

            {/* Tenant indicator for non-owner */}
            {user.role !== 'OWNER' && currentTenant && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-xs">
                  <span className="font-medium text-foreground">{currentTenant.name}</span>
                  <span className="text-muted-foreground ml-1.5 capitalize">· {currentTenant.plan}</span>
                </div>
              </div>
            )}

            {/* Platform indicator for owner */}
            {user.role === 'OWNER' && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <Globe className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Platform-wide view</span>
              </div>
            )}

            <div className="hidden md:block relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background" />
            </div>

            {user.role !== 'OWNER' && <NotificationsBell />}

            <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={() => setProfileOpen(true)} title="Click to manage your profile">
              <AvatarFallback className={cn('text-xs font-semibold', ROLE_META[user.role].color)}>
                {user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto" key={currencySymbolVersion}>
            {active === 'owner' && user.role === 'OWNER' && <OwnerConsole tenants={tenants} />}
            {active === 'dashboard' && <DashboardModule userRole={user.role} tenantId={user.tenantId} />}
            {active === 'inventory' && <InventoryModule userRole={user.role} />}
            {active === 'orders' && <OrdersModule userRole={user.role} />}
            {active === 'customers' && <CustomersModule userRole={user.role} />}
            {active === 'purchasing' && <PurchasingModule userRole={user.role} />}
            {active === 'hr' && <HRModule userRole={user.role} />}
            {active === 'rewards' && <RewardsModule userRole={user.role} userId={user.id} />}
            {active === 'finance' && <FinanceModule userRole={user.role} />}
            {active === 'accounting' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <AccountingModule userRole={user.role} />
            )}
            {active === 'reports' && <ReportsModule userRole={user.role} />}
            {active === 'reportBuilder' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <ReportBuilderModule userRole={user.role} />
            )}
            {active === 'workflows' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <WorkflowModule userRole={user.role} />
            )}
            {active === 'users' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <UserManagement users={tenantUsers} currentUser={user} tenant={currentTenant} userRole={user.role} />
            )}
            {active === 'auditLog' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <AuditLogModule userRole={user.role} />
            )}
            {active === 'settings' && (user.role === 'TENANT_ADMIN' || user.role === 'OWNER') && (
              <SettingsModule userRole={user.role} />
            )}
          </div>
        </main>

        <footer className="mt-auto border-t border-border/60 px-6 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>© Nexus ERP · Multi-Tenant SaaS</span>
          <span className="hidden sm:inline">Signed in as <span className="font-medium text-foreground">{user.email}</span></span>
        </footer>
      </div>

      {/* Profile dialog — opened by clicking the avatar */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}
