'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Building2, UserPlus, Edit, Shield, KeyRound } from 'lucide-react'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ErrorAlert({ error }: { error: string }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

// ============ Edit Tenant Form ============
export function EditTenantForm({ open, onClose, onSaved, tenant }: { open: boolean; onClose: () => void; onSaved: () => void; tenant: any }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', industry: '', plan: 'starter', seats: '10' })

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || '', industry: tenant.industry || '', plan: tenant.plan || 'starter', seats: String(tenant.seats || 10) })
    }
  }, [tenant])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/erp/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!tenant) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit Tenant</DialogTitle>
          <DialogDescription>Update tenant details. Changes apply immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Corporation Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Industry"><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></Field>
            <Field label="Plan">
              <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free ($0 - 3 users)</SelectItem>
                  <SelectItem value="starter">Starter ($49/user)</SelectItem>
                  <SelectItem value="pro">Pro ($199/user)</SelectItem>
                  <SelectItem value="enterprise">Enterprise ($499/user)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Seats"><Input type="number" min="1" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} /></Field>
          </div>
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Suspend Tenant Dialog ============
export function SuspendTenantDialog({ open, onClose, onConfirm, tenant }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; tenant: any }) {
  const [reason, setReason] = useState('')
  if (!tenant) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-amber-500" /> Suspend Tenant</DialogTitle>
          <DialogDescription>
            Suspending <strong>{tenant.name}</strong> will block all users in this tenant from logging in. They can be unsuspended later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Reason (optional)"><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Non-payment, policy violation" /></Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(reason)}>Suspend Tenant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Delete Tenant Dialog ============
export function DeleteTenantDialog({ open, onClose, onConfirm, tenant }: { open: boolean; onClose: () => void; onConfirm: () => void; tenant: any }) {
  const [confirmName, setConfirmName] = useState('')
  if (!tenant) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-rose-600">Delete Tenant Permanently</DialogTitle>
          <DialogDescription>
            This will <strong>permanently delete</strong> <strong>{tenant.name}</strong> and ALL associated data: users, products, customers, orders, POs, transactions, employees, audit logs — everything. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={`Type "${tenant.name}" to confirm`}>
            <Input value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={tenant.name} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={confirmName !== tenant.name} onClick={onConfirm}>Delete Permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Edit User Form ============
export function EditUserForm({ open, onClose, onSaved, user: targetUser }: { open: boolean; onClose: () => void; onSaved: () => void; user: any }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customRoles, setCustomRoles] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', role: 'EMPLOYEE' })

  useEffect(() => {
    if (targetUser) {
      // If user has a custom role, set the value to "CUSTOM:roleId"
      const roleVal = targetUser.role === 'CUSTOM' && targetUser.customRoleId
        ? `CUSTOM:${targetUser.customRoleId}`
        : targetUser.role || 'EMPLOYEE'
      setForm({ name: targetUser.name || '', role: roleVal })
    }
  }, [targetUser])

  // Fetch custom roles when dialog opens
  useEffect(() => {
    if (open) {
      fetch('/api/erp/roles').then(r => r.json()).then(d => {
        setCustomRoles(d.roles || [])
      }).catch(() => {})
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const body: any = { name: form.name }
      // Handle custom role selection
      if (form.role.startsWith('CUSTOM:')) {
        body.role = 'CUSTOM'
        body.customRoleId = form.role.split(':')[1]
      } else {
        body.role = form.role
        body.customRoleId = null
      }
      const res = await fetch(`/api/erp/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!targetUser) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit User</DialogTitle>
          <DialogDescription>Update name and role for {targetUser.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Role">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <option value="EMPLOYEE">Employee — limited module access</option>
                <option value="MANAGER">Manager — full ops + approve</option>
                <option value="TENANT_ADMIN">Tenant Admin — full access + user mgmt</option>
                {customRoles.filter(r => !r.isSystem).length > 0 && (
                  <optgroup label="Custom Roles">
                    {customRoles.filter(r => !r.isSystem).map(r => (
                      <option key={r.id} value={`CUSTOM:${r.id}`}>{r.name}{r.description ? ` — ${r.description}` : ''}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
          </div>
          <ErrorAlert error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Reset Password Dialog ============
export function ResetPasswordDialog({ open, onClose, onConfirm, user: targetUser }: { open: boolean; onClose: () => void; onConfirm: (newPassword: string) => void; user: any }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  if (!targetUser) return null

  function handleConfirm() {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    onConfirm(password)
    setPassword(''); setConfirm('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for {targetUser.name} ({targetUser.email}). They will need to use this new password to login.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="New Password *"><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" /></Field>
          <Field label="Confirm Password *"><Input type="password" minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
          {error && <ErrorAlert error={error} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleConfirm}>Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Disable/Delete User Dialog ============
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, variant }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel: string; variant?: 'default' | 'destructive'
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={variant === 'destructive' ? 'text-rose-600' : ''}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
