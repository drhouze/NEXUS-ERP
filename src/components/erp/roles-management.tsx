'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'

const ROLE_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders / Visits' },
  { key: 'customers', label: 'Customers / Patients' },
  { key: 'inventory', label: 'Inventory / Pharmacy' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'hr', label: 'HR' },
  { key: 'finance', label: 'Finance' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'reports', label: 'Reports' },
  { key: 'reportBuilder', label: 'Report Builder' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'userManagement', label: 'User Management' },
  { key: 'auditLog', label: 'Audit Log' },
  { key: 'settings', label: 'Settings' },
]

export function RolesManagementTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)
  const [error, setError] = useState('')

  function loadData() {
    setLoading(true)
    fetch('/api/erp/roles').then(r => r.json()).then(d => setRoles(d.roles || [])).catch(() => setError('Failed to load roles')).finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [])

  async function deleteRole(role: any) {
    if (!confirm(`Delete role "${role.name}"?`)) return
    const res = await fetch(`/api/erp/roles/${role.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) { alert(d.error); return }
    loadData()
  }

  if (loading) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">Custom Roles ({roles.filter(r => !r.isSystem).length})</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Create roles with specific module access. Assign them to users from User Management.</p>
          </div>
          <Button size="sm" onClick={() => { setEditingRole(null); setShowForm(true) }}><Plus className="h-4 w-4 mr-1" /> Create Role</Button>
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">System Roles (cannot be deleted):</p>
          <p>• <strong>Tenant Admin</strong> — full access + user management</p>
          <p>• <strong>Manager</strong> — operations + approvals</p>
          <p>• <strong>Employee</strong> — limited module access</p>
        </div>
        {roles.filter(r => !r.isSystem).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No custom roles yet. Create one (e.g. Doctor, Nurse, Cashier).</p>
        ) : (
          <div className="space-y-2">
            {roles.filter(r => !r.isSystem).map(role => {
              const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
              const modules = Object.keys(perms).filter(k => perms[k]?.length > 0)
              return (
                <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{role.name} <span className="text-xs text-muted-foreground">({role._count?.users || 0} users)</span></p>
                    <p className="text-xs text-muted-foreground">{role.description || ''}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {modules.map(m => {
                        const lbl = ROLE_MODULES.find(rm => rm.key === m)?.label || m
                        const hasEdit = perms[m]?.includes('edit')
                        return <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded-full ${hasEdit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{lbl}{hasEdit ? ' ✓' : ' 👁'}</span>
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingRole(role); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => deleteRole(role)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {showForm && <RoleForm role={editingRole} onClose={() => { setShowForm(false); setEditingRole(null) }} onSaved={() => { setShowForm(false); setEditingRole(null); loadData() }} />}
    </div>
  )
}

function RoleForm({ role, onClose, onSaved }: { role: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [permissions, setPermissions] = useState<Record<string, string[]>>(() => {
    if (role?.permissions) { try { return typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions } catch {} }
    return {}
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleModule(moduleKey: string, perm: string) {
    setPermissions(prev => {
      const current = prev[moduleKey] || []
      if (current.includes(perm)) {
        if (perm === 'view') { const next = { ...prev }; delete next[moduleKey]; return next }
        return { ...prev, [moduleKey]: current.filter(p => p !== perm) }
      } else {
        if (perm === 'edit') return { ...prev, [moduleKey]: ['view', 'edit'] }
        return { ...prev, [moduleKey]: [...current, perm] }
      }
    })
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const body = { name, description, permissions }
      const url = role ? `/api/erp/roles/${role.id}` : '/api/erp/roles'
      const method = role ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">{role ? 'Edit Role' : 'Create Custom Role'}</h4>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Role Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Doctor, Nurse" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this role can do" /></div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Module Permissions</Label>
        <p className="text-[10px] text-muted-foreground">View = read-only, Edit = create/modify. Uncheck both to hide the module.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLE_MODULES.map(mod => {
            const perms = permissions[mod.key] || []
            return (
              <div key={mod.key} className="flex items-center justify-between p-2 rounded-md border text-sm">
                <span className="font-medium">{mod.label}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={perms.includes('view')} onChange={() => toggleModule(mod.key, 'view')} className="accent-primary h-3.5 w-3.5" /><span className="text-xs">View</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={perms.includes('edit')} onChange={() => toggleModule(mod.key, 'edit')} className="accent-primary h-3.5 w-3.5" /><span className="text-xs">Edit</span></label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || !name}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{role ? 'Save Changes' : 'Create Role'}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  )
}
