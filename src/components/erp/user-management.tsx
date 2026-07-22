'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatNumber, formatDate, relativeTime } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users, Shield, UserCheck, User as UserIcon, Plus, Search, Mail, MoreVertical, Crown,
  Edit, KeyRound, Trash2, Ban, CheckCircle, AlertCircle, MailCheck,
} from 'lucide-react'
import { UserForm } from './admin-forms'
import { EditUserForm, ResetPasswordDialog, ConfirmDialog } from './manage-forms'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UserManagementProps {
  users: any[]
  currentUser: { id: string; email: string; name: string; role: string; tenantId?: string }
  tenant: any
  userRole?: string
}

const ROLE_META: Record<string, { label: string; icon: any; color: string; description: string }> = {
  TENANT_ADMIN: { label: 'Tenant Admin', icon: Shield, color: 'bg-indigo-100 text-indigo-700', description: 'Full access + user management' },
  MANAGER: { label: 'Manager', icon: UserCheck, color: 'bg-emerald-100 text-emerald-700', description: 'Department lead, can approve' },
  EMPLOYEE: { label: 'Employee', icon: UserIcon, color: 'bg-slate-100 text-slate-700', description: 'Limited module access' },
}

export function UserManagement({ users: initialUsers, currentUser, tenant, userRole = 'TENANT_ADMIN' }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Dialogs
  const [editUser, setEditUser] = useState<any>(null)
  const [resetUser, setResetUser] = useState<any>(null)
  const [disableUser, setDisableUser] = useState<any>(null)
  const [deleteUser, setDeleteUser] = useState<any>(null)

  const isOwner = userRole === 'OWNER'

  const loadData = async () => {
    // OWNER: fetch all users (API returns all tenants when no tenantId specified)
    // TENANT_ADMIN: fetch own tenant users (API auto-scopes)
    const res = await fetch('/api/erp/users')
    if (res.ok) {
      const data = await res.json()
      if (data.users) setUsers(data.users)
    }
  }
  useEffect(() => {
    let cancelled = false
    if (initialUsers.length === 0) {
      (async () => {
        const res = await fetch('/api/erp/users')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data.users) setUsers(data.users)
        }
      })()
    }
    return () => { cancelled = true }
  }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const admins = users.filter(u => u.role === 'TENANT_ADMIN').length
  const managers = users.filter(u => u.role === 'MANAGER').length
  const employees = users.filter(u => u.role === 'EMPLOYEE').length
  const activeUsers = users.filter(u => u.status === 'active').length

  async function patchUser(id: string, body: any) {
    setError(''); setSuccess('')
    const res = await fetch(`/api/erp/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); return false }
    setSuccess('Action completed successfully')
    loadData()
    return true
  }

  async function deleteUserById(id: string) {
    setError(''); setSuccess('')
    const res = await fetch(`/api/erp/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); return }
    setSuccess('User deleted')
    loadData()
  }

  return (
    <div className="space-y-6">
      {/* Tenant header */}
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700 text-white border-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 opacity-80" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                {isOwner ? 'Owner Managing Tenant' : 'Tenant Administration'}
              </span>
            </div>
            <h2 className="text-2xl font-bold">{tenant?.name || 'Tenant'}</h2>
            <p className="text-sm opacity-90 mt-1">
              {tenant?.industry} · {tenant?.plan?.toUpperCase()} plan · {tenant?.seats} seats · {users.length} users
            </p>
          </div>
          <Button className="bg-white text-indigo-700 hover:bg-white/90 hidden sm:flex" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Invite User
          </Button>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={formatNumber(users.length)} icon={Users} accent="indigo" hint={`${activeUsers} active`} />
        <KpiCard label="Admins" value={formatNumber(admins)} icon={Shield} accent="purple" />
        <KpiCard label="Managers" value={formatNumber(managers)} icon={UserCheck} accent="emerald" />
        <KpiCard label="Employees" value={formatNumber(employees)} icon={UserIcon} accent="amber" />
      </div>

      {/* Role legend */}
      <SectionCard title="Role Hierarchy" subtitle="Permission levels in this organization">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const Icon = meta.icon
            const count = users.filter(u => u.role === role).length
            return (
              <div key={role} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`rounded-lg p-2 ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">{count} user{count !== 1 ? 's' : ''}</Badge>
                </div>
                <h4 className="font-semibold">{meta.label}</h4>
                <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Users table */}
      <SectionCard
        title="User Directory"
        subtitle={`${filtered.length} of ${users.length} users`}
        action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Invite</Button>}
      >
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Nex Coins</th>
                <th className="pb-2 pr-4 font-medium">Last Login</th>
                <th className="pb-2 pr-4 font-medium">Joined</th>
                <th className="pb-2 pr-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const meta = ROLE_META[u.role] || ROLE_META.EMPLOYEE
                const Icon = meta.icon
                const isSelf = u.id === currentUser.id
                return (
                  <tr key={u.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={`text-xs font-semibold ${meta.color}`}>
                            {u.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{u.name}</p>
                            {isSelf && <Badge variant="secondary" className="text-[10px] py-0 h-4">YOU</Badge>}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{u.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {u.portalType && u.portalType !== 'staff' && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          {u.portalType}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={u.status} /></td>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-amber-700 tabular-nums">{formatNumber(u.points || 0)}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Never'}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(u.createdAt)}</td>
                    <td className="py-3 pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSelf}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(u)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetUser(u)}>
                            <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
                          </DropdownMenuItem>
                          {u.status === 'active' ? (
                            <DropdownMenuItem onClick={() => setDisableUser(u)}>
                              <Ban className="h-3.5 w-3.5 mr-2" /> Disable User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { status: 'active' })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2" /> Enable User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => setDeleteUser(u)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No users match your search</div>
          )}
        </div>
      </SectionCard>

      {/* Dialogs */}
      <UserForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} currentTenantName={tenant?.name} />
      <EditUserForm open={!!editUser} onClose={() => setEditUser(null)} onSaved={loadData} user={editUser} />
      <ResetPasswordDialog
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        onConfirm={async (pw) => { await patchUser(resetUser.id, { newPassword: pw }); setResetUser(null) }}
        user={resetUser}
      />
      <ConfirmDialog
        open={!!disableUser}
        onClose={() => setDisableUser(null)}
        onConfirm={async () => { await patchUser(disableUser.id, { status: 'disabled' }); setDisableUser(null) }}
        title="Disable User"
        description={`${disableUser?.name} will no longer be able to login. They can be re-enabled later.`}
        confirmLabel="Disable User"
        variant="destructive"
      />
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={async () => { await deleteUserById(deleteUser.id); setDeleteUser(null) }}
        title="Delete User Permanently"
        description={`${deleteUser?.name} (${deleteUser?.email}) will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        variant="destructive"
      />
    </div>
  )
}
