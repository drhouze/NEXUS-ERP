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
import { Loader2, AlertCircle, CheckCircle2, Building2, UserPlus } from 'lucide-react'

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

// ============ Tenant Form (OWNER only) ============
export function TenantForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    tenantName: '', industry: 'Technology', plan: 'starter', seats: '10',
    adminName: '', adminEmail: '', adminPassword: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSuccess(`Tenant "${form.tenantName}" created! Admin can login with ${form.adminEmail} (password: ${form.adminPassword})`)
      onCreated()
      setForm({ tenantName: '', industry: 'Technology', plan: 'starter', seats: '10', adminName: '', adminEmail: '', adminPassword: '' })
      // Don't auto-close so user can see success message + copy login credentials
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !success) { onClose(); setError('') } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Create New Tenant
          </DialogTitle>
          <DialogDescription>
            Register a new corporation on the platform. A tenant admin account will be created automatically so they can login and start managing their ERP.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              <strong>Tenant created successfully!</strong>
              <br />
              {success}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Tenant Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Corporation Name *"><Input required value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} placeholder="e.g. Acme Corp" /></Field>
                <Field label="Industry"><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Technology" /></Field>
                <Field label="Plan">
                  <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free ($0 - 3 users)</SelectItem>
                      <SelectItem value="starter">Starter ($49/user/mo)</SelectItem>
                      <SelectItem value="pro">Pro ($199/user/mo)</SelectItem>
                      <SelectItem value="enterprise">Enterprise ($499/user/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Seats"><Input type="number" min="1" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} /></Field>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Tenant Admin Account</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Admin Name *"><Input required value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} placeholder="e.g. John Smith" /></Field>
                <Field label="Admin Email *"><Input required type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@company.com" /></Field>
                <Field label="Admin Password *"><Input required type="password" minLength={6} value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Min 6 characters" /></Field>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This user will have full TENANT_ADMIN access to the new tenant's data.
              </p>
            </div>

            <ErrorAlert error={error} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        )}

        {success && (
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============ User Form (TENANT_ADMIN only) ============
export function UserForm({ open, onClose, onCreated, currentTenantName }: { open: boolean; onClose: () => void; onCreated: () => void; currentTenantName?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [customRoles, setCustomRoles] = useState<any[]>([])
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'EMPLOYEE', customRoleId: '',
  })

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
    setLoading(true); setError(''); setSuccess('')
    try {
      const body: any = { name: form.name, email: form.email, password: form.password }
      // Handle custom role selection (value is "CUSTOM:roleId")
      if (form.role.startsWith('CUSTOM:')) {
        body.role = 'CUSTOM'
        body.customRoleId = form.role.split(':')[1]
      } else {
        body.role = form.role
      }
      const res = await fetch('/api/erp/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSuccess(`User "${form.name}" added to ${currentTenantName || 'your tenant'}. They can login with ${form.email}.`)
      onCreated()
      setForm({ name: '', email: '', password: '', role: 'EMPLOYEE', customRoleId: '' })
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !success) { onClose(); setError('') } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Add a new user to {currentTenantName || 'your tenant'}. They will be able to login immediately with the credentials you set.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              <strong>User invited!</strong>
              <br />
              {success}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Connor" /></Field>
              <Field label="Email *"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sarah@company.com" /></Field>
              <Field label="Password *"><Input required type="password" minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></Field>
              <Field label="Role *">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value, customRoleId: '' })}
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
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Invite User
              </Button>
            </DialogFooter>
          </form>
        )}

        {success && (
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
