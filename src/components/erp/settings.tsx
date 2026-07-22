'use client'

import { useEffect, useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard } from './shared'
import { formatCurrency, formatDate, relativeTime } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Settings as SettingsIcon, Crown, Check, Download, Upload, Loader2, CheckCircle2,
  Building2, Database, Shield, KeyRound, AlertCircle, Webhook, Mail,
  Clock, Copy, Plus, Trash2, Power, Smartphone, Server, Globe,
  Stethoscope, SlidersHorizontal, Pencil, X,
  Receipt, Files, Palette, FolderInput, Shirt, Users, FileText,
} from 'lucide-react'
import { EncounterFormDesigner } from './encounter-form-designer'
import { RolesManagementTab } from './roles-management'
import { DocumentTemplateDesigner } from './document-template-designer'

interface TenantData {
  id: string
  name: string
  industry: string
  plan: string
  status: string
  seats: number
  createdAt: string
}

// ============ Sidebar nav structure ============
interface NavSection {
  key: string
  label: string
  icon: any
  group: string
}

const SECTIONS: NavSection[] = [
  // Account
  { key: 'subscription', label: 'Subscription', icon: Crown, group: 'Account' },

  // Finance
  { key: 'numbering', label: 'Numbering', icon: Database, group: 'Finance' },
  { key: 'currencies', label: 'Currencies', icon: Globe, group: 'Finance' },
  { key: 'duitnow', label: 'DuitNow QR', icon: Smartphone, group: 'Finance' },

  // Customization
  { key: 'customFields', label: 'Fields / Tabs / Statuses', icon: SlidersHorizontal, group: 'Customization' },
  { key: 'documentTemplates', label: 'Document Templates', icon: Files, group: 'Customization' },
  { key: 'serviceForm', label: 'Service Form Designer', icon: Stethoscope, group: 'Customization' },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield, group: 'Customization' },

  // Security & Access
  { key: 'security', label: 'Security (2FA)', icon: Shield, group: 'Security & Access' },
  { key: 'sso', label: 'SSO', icon: Server, group: 'Security & Access' },
  { key: 'apiKeys', label: 'API Keys', icon: KeyRound, group: 'Security & Access' },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook, group: 'Security & Access' },

  // Data & Backup
  { key: 'retention', label: 'Data Retention', icon: Clock, group: 'Data & Backup' },
  { key: 'emails', label: 'Email Log', icon: Mail, group: 'Data & Backup' },
  { key: 'backup', label: 'Backup', icon: Database, group: 'Data & Backup' },
]

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  subscription: { title: 'Subscription & Billing', subtitle: 'Manage your plan, seats and renewal' },
  numbering: { title: 'Document Numbering', subtitle: 'Customize prefixes and starting numbers' },
  currencies: { title: 'Currencies', subtitle: 'Multi-currency support and exchange rates' },
  duitnow: { title: 'DuitNow QR Payments', subtitle: 'Accept payments via Malaysian QR wallets' },
  customFields: { title: 'Custom Fields, Tabs & Statuses', subtitle: 'Add custom fields per module + configure pipelines' },
  documentTemplates: { title: 'Document Templates', subtitle: 'Customize invoices, quotations, receipts, POs and more' },
  serviceForm: { title: 'Service Form Designer', subtitle: 'Build your industry-specific service / encounter form' },
  roles: { title: 'Roles & Permissions', subtitle: 'Create custom roles with module-level access control' },
  security: { title: 'Two-Factor Authentication', subtitle: 'Add an extra layer of login security' },
  sso: { title: 'Single Sign-On (SAML/OIDC)', subtitle: 'Configure identity-provider integration' },
  apiKeys: { title: 'API Keys', subtitle: 'Programmatic access tokens' },
  webhooks: { title: 'Webhooks', subtitle: 'Receive real-time event callbacks' },
  retention: { title: 'Data Retention Policy', subtitle: 'Automatic cleanup of old records' },
  emails: { title: 'Email Log', subtitle: 'Audit trail of outbound emails' },
  backup: { title: 'Backup & Restore', subtitle: 'Export or import tenant data' },
}

export function SettingsModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [activeSection, setActiveSection] = useState('subscription')
  const groups = Array.from(new Set(SECTIONS.map(s => s.group)))
  const current = SECTION_TITLES[activeSection] || { title: 'Settings', subtitle: '' }
  const ActiveIcon = SECTIONS.find(s => s.key === activeSection)?.icon || SettingsIcon

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <SettingsIcon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Settings</span>
          </div>
          <h2 className="text-2xl font-bold">Tenant Configuration</h2>
          <p className="text-sm opacity-90 mt-1">Manage your subscription, security, integrations, customizations, and data retention.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
            {groups.map(group => (
              <div key={group} className="lg:mb-3 shrink-0">
                <p className="hidden lg:block px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group}</p>
                <div className="flex lg:flex-col gap-1">
                  {SECTIONS.filter(s => s.group === group).map(section => {
                    const Icon = section.icon
                    const isActive = activeSection === section.key
                    return (
                      <button
                        key={section.key}
                        onClick={() => setActiveSection(section.key)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap lg:w-full transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="hidden lg:inline">{section.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <ActiveIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{current.title}</h3>
              <p className="text-xs text-muted-foreground">{current.subtitle}</p>
            </div>
          </div>

          {activeSection === 'subscription' && <SubscriptionTab />}
          {activeSection === 'numbering' && <NumberingTab />}
          {activeSection === 'currencies' && <CurrenciesTab />}
          {activeSection === 'duitnow' && <DuitNowTab />}
          {activeSection === 'customFields' && <CustomFieldsManager />}
          {activeSection === 'documentTemplates' && <DocumentTemplateDesignerTab />}
          {activeSection === 'serviceForm' && <EncounterFormDesignerTab />}
          {activeSection === 'roles' && <RolesManagementTab />}
          {activeSection === 'security' && <SecurityTab />}
          {activeSection === 'sso' && <SsoTab />}
          {activeSection === 'apiKeys' && <ApiKeysTab />}
          {activeSection === 'webhooks' && <WebhooksTab />}
          {activeSection === 'retention' && <RetentionTab />}
          {activeSection === 'emails' && <EmailLogTab />}
          {activeSection === 'backup' && <BackupTab />}
        </div>
      </div>
    </div>
  )
}

// ============ Wrapper tabs for embedded designers ============
function EncounterFormDesignerTab() {
  return (
    <Card className="p-4">
      <EncounterFormDesigner />
    </Card>
  )
}

function DocumentTemplateDesignerTab() {
  return (
    <Card className="p-4">
      <DocumentTemplateDesigner />
    </Card>
  )
}

// ============ Subscription Tab ============
function SubscriptionTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = () => fetch('/api/erp/settings').then(r => r.json()).then(d => { if (d.tenant) setData(d) })
  useEffect(() => { loadData() }, [])

  async function upgradePlan(plan: string) {
    if (!confirm(`Upgrade to ${plan.toUpperCase()} plan?`)) return
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Upgraded to ${plan.toUpperCase()}!`)
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />
  const { tenant, allPlans } = data
  const planOrder = ['free', 'starter', 'pro', 'enterprise']

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {planOrder.map((plan) => {
          const planData = allPlans[plan]
          const isCurrent = tenant.plan === plan
          const currentIdx = planOrder.indexOf(tenant.plan)
          const thisIdx = planOrder.indexOf(plan)
          const isUpgrade = thisIdx > currentIdx

          return (
            <Card key={plan} className={`p-5 border-2 relative ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'} ${plan === 'free' ? 'ring-1 ring-emerald-200' : ''}`}>
              {plan === 'free' && !isCurrent && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Free Forever</div>
              )}
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold capitalize">{plan}</h4>
                {isCurrent && <Badge className="bg-primary">Current</Badge>}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold">{formatCurrency(planData.price)}</span>
                <span className="text-sm text-muted-foreground">{planData.price === 0 ? 'forever' : '/user/mo'}</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {planData.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span>{f}</span></li>
                ))}
              </ul>
              {!isCurrent && <Button className="w-full" variant={isUpgrade ? 'default' : 'outline'} disabled={loading} onClick={() => upgradePlan(plan)}>{isUpgrade ? `Upgrade to ${plan}` : `Switch to ${plan}`}</Button>}
              {isCurrent && <Button className="w-full" disabled>Current Plan</Button>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ============ Security Tab (2FA) ============
function SecurityTab() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [setupData, setSetupData] = useState<any>(null)
  const [code, setCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetch('/api/auth/me').then(r => r.json()).then(d => setEnabled(d.user?.twoFactorEnabled || false)) }, [])

  async function startSetup() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/2fa/setup', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSetupData(d)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function verifyAndEnable() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/2fa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEnabled(true); setSetupData(null); setCode(''); setSuccess('2FA enabled!')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function disable2FA() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/2fa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: disableCode }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEnabled(false); setDisableCode(''); setSuccess('2FA disabled')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5"><Smartphone className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold">Two-Factor Authentication (TOTP)</h4>
            <p className="text-xs text-muted-foreground">Add an extra layer of security with Google Authenticator, Authy, or 1Password</p>
          </div>
          <Badge className={enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>

        {!enabled && !setupData && (
          <Button onClick={startSetup} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Set Up 2FA</Button>
        )}

        {!enabled && setupData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-2 block">Scan with your authenticator app:</Label>
                <img src={setupData.qrCode} alt="2FA QR Code" className="rounded-lg border border-border max-w-[200px]" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Or enter this secret manually:</Label>
                <Input readOnly value={setupData.secret} className="font-mono text-xs mb-3" />
                <Label className="text-xs mb-1 block">Save these backup codes (use once each if you lose your device):</Label>
                <div className="grid grid-cols-2 gap-1 p-3 rounded-lg bg-muted">
                  {setupData.backupCodes.map((c: string, i: number) => (
                    <code key={i} className="text-xs font-mono">{c}</code>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Enter the 6-digit code from your authenticator app to verify:</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} className="font-mono text-center text-lg max-w-[160px]" />
                <Button onClick={verifyAndEnable} disabled={loading || code.length !== 6}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Verify & Enable</Button>
                <Button variant="outline" onClick={() => setSetupData(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {enabled && (
          <div className="space-y-3">
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800">2FA is enabled. You'll need a code from your authenticator app to login.</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label className="text-xs">To disable 2FA, enter a current TOTP code or backup code:</Label>
              <div className="flex gap-2">
                <Input value={disableCode} onChange={e => setDisableCode(e.target.value)} placeholder="6-digit code or backup code" className="max-w-[200px]" />
                <Button variant="destructive" onClick={disable2FA} disabled={loading || !disableCode}>Disable 2FA</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============ API Keys Tab ============
function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', scopes: ['read'], expiresInDays: '' })

  const loadData = () => fetch('/api/erp/api-keys').then(r => r.json()).then(d => setKeys(d.keys || []))
  useEffect(() => { loadData() }, [])

  async function createKey() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, expiresInDays: form.expiresInDays ? parseInt(form.expiresInDays) : null }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setNewKey(d.rawKey)
      setShowCreate(false)
      setForm({ name: '', scopes: ['read'], expiresInDays: '' })
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function toggleKey(id: string, isActive: boolean) {
    await fetch(`/api/erp/api-keys/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) })
    loadData()
  }

  async function deleteKey(id: string) {
    if (!confirm('Delete this API key permanently?')) return
    await fetch(`/api/erp/api-keys/${id}`, { method: 'DELETE' })
    loadData()
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {newKey && (
        <Alert className="border-amber-200 bg-amber-50">
          <KeyRound className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>API Key created! Copy it now — it won't be shown again:</strong>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 p-2 rounded bg-white border font-mono text-xs break-all">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey) }}><Copy className="h-3 w-3 mr-1" />Copy</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <SectionCard title="API Keys" subtitle={`${keys.length} keys`} action={<Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="h-4 w-4 mr-2" />Generate Key</Button>}>
        {showCreate && (
          <div className="mb-4 p-4 rounded-lg border border-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Key Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Production API" /></div>
              <div><Label className="text-xs">Expires in (days, optional)</Label><Input type="number" value={form.expiresInDays} onChange={e => setForm({ ...form, expiresInDays: e.target.value })} placeholder="e.g. 365" /></div>
            </div>
            <div>
              <Label className="text-xs">Scopes</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {['read', 'write', 'admin'].map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.scopes.includes(s)} onChange={e => { const next = e.target.checked ? [...form.scopes, s] : form.scopes.filter(x => x !== s); setForm({ ...form, scopes: next }) }} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createKey} disabled={loading || !form.name}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Generate</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Key</th>
              <th className="pb-2 pr-4 font-medium">Scopes</th>
              <th className="pb-2 pr-4 font-medium">Last Used</th>
              <th className="pb-2 pr-4 font-medium">Expires</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium text-right">Actions</th>
            </tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4 font-medium">{k.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{k.keyPrefix}...</td>
                  <td className="py-3 pr-4">{JSON.parse(k.scopes).map((s: string) => <Badge key={s} variant="outline" className="mr-1 text-xs">{s}</Badge>)}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{k.lastUsedAt ? relativeTime(k.lastUsedAt) : 'Never'}</td>
                  <td className="py-3 pr-4 text-xs">{k.expiresAt ? formatDate(k.expiresAt) : 'Never'}</td>
                  <td className="py-3 pr-4"><Badge className={k.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{k.isActive ? 'Active' : 'Revoked'}</Badge></td>
                  <td className="py-3 pr-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleKey(k.id, k.isActive)}><Power className="h-3 w-3 mr-1" />{k.isActive ? 'Revoke' : 'Activate'}</Button>
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteKey(k.id)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {keys.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No API keys yet</div>}
        </div>
      </SectionCard>
    </div>
  )
}

// ============ Webhooks Tab ============
function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ url: '', secret: '', events: [] as string[] })

  const EVENTS = [
    'order.created', 'order.delivered', 'order.cancelled',
    'customer.created', 'product.created', 'product.low_stock',
    'purchase_order.received', 'user.invited', 'tenant.suspended',
  ]

  const loadData = () => fetch('/api/erp/webhooks').then(r => r.json()).then(d => setWebhooks(d.webhooks || []))
  useEffect(() => { loadData() }, [])

  async function createWebhook() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setShowCreate(false); setForm({ url: '', secret: '', events: [] }); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return
    await fetch(`/api/erp/webhooks/${id}`, { method: 'DELETE' })
    loadData()
  }

  async function toggleWebhook(id: string, isActive: boolean) {
    await fetch(`/api/erp/webhooks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) })
    loadData()
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <SectionCard title="Webhooks" subtitle={`${webhooks.length} endpoints`} action={<Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="h-4 w-4 mr-2" />Add Webhook</Button>}>
        {showCreate && (
          <div className="mb-4 p-4 rounded-lg border border-border space-y-3">
            <div><Label className="text-xs">URL *</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://your-app.com/webhook" /></div>
            <div><Label className="text-xs">Secret (optional, for HMAC signature)</Label><Input value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} placeholder="whsec_..." /></div>
            <div>
              <Label className="text-xs">Events to subscribe:</Label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {EVENTS.map(e => (
                  <label key={e} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.events.includes(e)} onChange={ev => { const next = ev.target.checked ? [...form.events, e] : form.events.filter(x => x !== e); setForm({ ...form, events: next }) }} />
                    <code className="text-xs">{e}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createWebhook} disabled={loading || !form.url}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {webhooks.map(w => (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <code className="text-sm font-mono truncate">{w.url}</code>
                    <Badge className={w.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{w.isActive ? 'Active' : 'Paused'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {JSON.parse(w.events).map((e: string) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleWebhook(w.id, w.isActive)}><Power className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteWebhook(w.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              {w.deliveries?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-1">Recent deliveries:</p>
                  <div className="space-y-1">
                    {w.deliveries.slice(0, 5).map((d: any) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs">
                        <Badge className={d.status === 'success' ? 'bg-emerald-100 text-emerald-700' : d.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>{d.status}</Badge>
                        <code className="text-muted-foreground">{d.event}</code>
                        {d.statusCode && <span className="text-muted-foreground">{d.statusCode}</span>}
                        <span className="text-muted-foreground">{relativeTime(d.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
          {webhooks.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No webhooks configured</div>}
        </div>
      </SectionCard>
    </div>
  )
}

// ============ SSO Tab ============
function SsoTab() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ provider: 'saml', entityId: '', ssoUrl: '', certificate: '', isActive: false })

  const loadData = () => fetch('/api/erp/sso').then(r => r.json()).then(d => {
    setConfig(d.config)
    if (d.config) setForm({ provider: d.config.provider, entityId: d.config.entityId || '', ssoUrl: d.config.ssoUrl || '', certificate: d.config.certificate || '', isActive: d.config.isActive })
  })
  useEffect(() => { loadData() }, [])

  async function save() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess('SSO config saved')
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5"><Server className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold">SSO / SAML Configuration</h4>
            <p className="text-xs text-muted-foreground">Configure single sign-on with your identity provider (Okta, Azure AD, Google Workspace)</p>
          </div>
          {config?.isActive && <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge>}
        </div>

        <div className="space-y-3">
          <div><Label className="text-xs">Provider</Label>
            <div className="flex gap-2 mt-1">
              {['saml', 'oidc'].map(p => (
                <button key={p} onClick={() => setForm({ ...form, provider: p })} className={`px-3 py-1.5 rounded-lg border text-sm ${form.provider === p ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{p.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs">Entity ID / Issuer</Label><Input value={form.entityId} onChange={e => setForm({ ...form, entityId: e.target.value })} placeholder="https://your-tenant.nexus-erp.com" /></div>
          <div><Label className="text-xs">SSO Login URL</Label><Input value={form.ssoUrl} onChange={e => setForm({ ...form, ssoUrl: e.target.value })} placeholder="https://your-idp.com/sso/saml" /></div>
          <div><Label className="text-xs">X.509 Certificate (PEM format)</Label><textarea value={form.certificate} onChange={e => setForm({ ...form, certificate: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" className="w-full min-h-[100px] p-2 rounded-lg border border-border font-mono text-xs" /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Enable SSO (users will be redirected to IdP on login)
          </label>
          <Button onClick={save} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save SSO Config</Button>
        </div>
      </Card>
    </div>
  )
}

// ============ Data Retention Tab ============
function RetentionTab() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ auditLogDays: 365, notificationDays: 90, emailLogDays: 90, autoArchive: true })

  const loadData = () => fetch('/api/erp/retention').then(r => r.json()).then(d => {
    if (d.settings) { setSettings(d.settings); setForm({ auditLogDays: d.settings.auditLogDays, notificationDays: d.settings.notificationDays, emailLogDays: d.settings.emailLogDays, autoArchive: d.settings.autoArchive }) }
  })
  useEffect(() => { loadData() }, [])

  async function save() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/retention', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess('Retention settings saved'); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function runCleanup() {
    if (!confirm('Run cleanup now? This will permanently delete old records based on your settings.')) return
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/retention', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Cleanup complete: deleted ${d.deleted.auditLogs} audit logs, ${d.deleted.notifications} notifications, ${d.deleted.emailLogs} email logs`)
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!settings) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5"><Clock className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold">Data Retention Policy</h4>
            <p className="text-xs text-muted-foreground">Automatically delete old records to comply with data regulations</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Audit Log Retention (days)</Label><Input type="number" value={form.auditLogDays} onChange={e => setForm({ ...form, auditLogDays: parseInt(e.target.value) || 0 })} /><p className="text-xs text-muted-foreground mt-1">0 = never delete</p></div>
            <div><Label className="text-xs">Notification Retention (days)</Label><Input type="number" value={form.notificationDays} onChange={e => setForm({ ...form, notificationDays: parseInt(e.target.value) || 0 })} /></div>
            <div><Label className="text-xs">Email Log Retention (days)</Label><Input type="number" value={form.emailLogDays} onChange={e => setForm({ ...form, emailLogDays: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.autoArchive} onChange={e => setForm({ ...form, autoArchive: e.target.checked })} />
            Auto-archive (run cleanup automatically daily)
          </label>
          {settings.lastRunAt && <p className="text-xs text-muted-foreground">Last cleanup: {formatDate(settings.lastRunAt)} ({relativeTime(settings.lastRunAt)})</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save Settings</Button>
            <Button variant="outline" onClick={runCleanup} disabled={loading}>Run Cleanup Now</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============ Email Log Tab ============
function EmailLogTab() {
  const [emails, setEmails] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  const loadData = () => fetch('/api/erp/email-log').then(r => r.json()).then(d => setEmails(d.emails || []))
  useEffect(() => { loadData() }, [])

  return (
    <SectionCard title="Email Log" subtitle={`${emails.length} emails sent (simulated)`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">To</th>
            <th className="pb-2 pr-4 font-medium">Subject</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Sent</th>
            <th className="pb-2 pr-4 font-medium"></th>
          </tr></thead>
          <tbody>
            {emails.map(e => (
              <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(e)}>
                <td className="py-3 pr-4">{e.to}</td>
                <td className="py-3 pr-4 font-medium">{e.subject}</td>
                <td className="py-3 pr-4"><Badge variant="outline" className="text-xs">{e.type}</Badge></td>
                <td className="py-3 pr-4"><Badge className={e.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>{e.status}</Badge></td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{relativeTime(e.createdAt)}</td>
                <td className="py-3 pr-4"><Mail className="h-3 w-3 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {emails.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No emails sent yet</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <Card className="p-5 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Email Details</h4>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">To:</span> {selected.to}</div>
              <div><span className="text-muted-foreground">Subject:</span> {selected.subject}</div>
              <div><span className="text-muted-foreground">Type:</span> {selected.type}</div>
              <div><span className="text-muted-foreground">Sent:</span> {formatDate(selected.createdAt)}</div>
              <div><span className="text-muted-foreground">Status:</span> {selected.status}</div>
              <div className="mt-3 p-3 rounded-lg bg-muted whitespace-pre-wrap font-mono text-xs">{selected.body}</div>
            </div>
          </Card>
        </div>
      )}
    </SectionCard>
  )
}

// ============ DuitNow QR Tab ============
function DuitNowTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ merchantId: '', apiKey: '', apiSecret: '', isLive: false, displayName: 'Pay with DuitNow QR', webhookUrl: '' })

  const loadData = () => fetch('/api/erp/duitnow').then(r => r.json()).then(d => {
    if (d.settings) {
      setData(d.settings)
      setForm({
        merchantId: d.settings.merchantId || '',
        apiKey: d.settings.apiKey || '',
        apiSecret: '',
        isLive: d.settings.isLive,
        displayName: d.settings.displayName,
        webhookUrl: d.settings.webhookUrl || '',
      })
    }
  })
  useEffect(() => { loadData() }, [])

  async function save() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/duitnow', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess('DuitNow settings saved'); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-blue-50 p-2.5">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-600" fill="currentColor"><path d="M3 3h18v18H3V3zm6 4h-2v2h2V7zm0 4h-2v2h2v-2zm0 4h-2v2h2v-2zm8-8h-6v2h6V7zm0 4h-6v2h6v-2zm0 4h-6v2h6v-2z"/></svg>
          </div>
          <div>
            <h4 className="font-semibold">DuitNow QR Payment</h4>
            <p className="text-xs text-muted-foreground">Accept payments via Touch 'n Go, GrabPay, Boost, ShopeePay, and all Malaysian bank apps with one QR code</p>
          </div>
          <Badge className={data.isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{data.isLive ? 'Live' : 'Demo Mode'}</Badge>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Merchant ID</Label>
              <Input value={form.merchantId} onChange={e => setForm({ ...form, merchantId: e.target.value })} placeholder="DN-MERCHANT-XXXXX" />
            </div>
            <div>
              <Label className="text-xs">Display Name (shown on payment page)</Label>
              <Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">API Key</Label>
              <Input value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder="Your gateway API key" />
            </div>
            <div>
              <Label className="text-xs">API Secret {data.apiSecret && <span className="text-muted-foreground ml-1">(current: {data.apiSecret})</span>}</Label>
              <Input type="password" value={form.apiSecret} onChange={e => setForm({ ...form, apiSecret: e.target.value })} placeholder="Enter new secret to change" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Webhook URL (for payment callbacks)</Label>
            <Input value={form.webhookUrl} onChange={e => setForm({ ...form, webhookUrl: e.target.value })} placeholder="https://yourapp.com/api/erp/duitnow/webhook" />
            <p className="text-[10px] text-muted-foreground mt-1">Set this URL in your payment gateway dashboard to receive payment notifications</p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isLive} onChange={e => setForm({ ...form, isLive: e.target.checked })} />
            Enable Live Mode (uncheck to use demo mode for testing)
          </label>

          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-xs">
              <strong>How to get DuitNow merchant credentials:</strong>
              <br />
              1. Register with a payment gateway (Revenue Monster, iPay88, or SenangPay)
              <br />2. Submit your business registration documents (SSM, bank statement)
              <br />3. Get approved (1-3 business days)
              <br />4. Copy your Merchant ID, API Key, and API Secret here
              <br />5. Set the webhook URL in your gateway dashboard
              <br />6. Check "Enable Live Mode" to start accepting real payments
            </AlertDescription>
          </Alert>

          <Button onClick={save} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save DuitNow Settings
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Your customers can pay with:</p>
        <div className="flex flex-wrap gap-2">
          {["Touch 'n Go", 'GrabPay', 'Boost', 'ShopeePay', 'Maybank QRPay', 'CIMB QRPay', 'RHB Pay', 'All Bank Apps'].map(w => (
            <Badge key={w} variant="outline" className="text-xs">{w}</Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============ Currencies Tab ============
function CurrenciesTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', rate: '' })

  const loadData = () => fetch('/api/erp/currencies').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  async function setBase(currencyId: string, code: string) {
    if (!confirm(`Set ${code} as your base currency? All existing prices will be interpreted as ${code}.`)) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/currencies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_base', currencyId, newBaseCode: code }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Base currency set to ${code}`); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function updateRate(currencyId: string, code: string) {
    const rate = prompt(`Enter new exchange rate for ${code} (1 USD = ? ${code}):`)
    if (!rate) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/currencies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_rate', currencyId, rate }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`${code} rate updated to ${rate}`); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function addCurrency() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/currencies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_currency', ...newCurrency, rate: newCurrency.rate || '1' }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setShowAdd(false); setNewCurrency({ code: '', name: '', symbol: '', rate: '' }); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <SectionCard title="Currencies" subtitle={`${data.currencies?.length || 0} currencies`} action={<Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-2" />Add Currency</Button>}>
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg border border-border grid grid-cols-4 gap-3 items-end">
            <div><Label className="text-xs">Code</Label><Input value={newCurrency.code} onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })} placeholder="THB" /></div>
            <div><Label className="text-xs">Name</Label><Input value={newCurrency.name} onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })} placeholder="Thai Baht" /></div>
            <div><Label className="text-xs">Symbol</Label><Input value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} placeholder="฿" /></div>
            <div><Label className="text-xs">Rate (1 USD = ?)</Label><Input type="number" step="0.01" value={newCurrency.rate} onChange={e => setNewCurrency({ ...newCurrency, rate: e.target.value })} placeholder="35.5" /></div>
            <div className="col-span-4 flex gap-2"><Button size="sm" onClick={addCurrency}>Add</Button><Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button></div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
              <th className="pb-2 pr-4 font-medium">Code</th>
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Symbol</th>
              <th className="pb-2 pr-4 font-medium text-right">Rate (per USD)</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium text-right">Actions</th>
            </tr></thead>
            <tbody>
              {data.currencies?.map((c: any) => (
                <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-4 font-mono font-medium">{c.code}</td>
                  <td className="py-3 pr-4">{c.name}</td>
                  <td className="py-3 pr-4 text-lg">{c.symbol}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{c.exchangeRates?.[0]?.rate?.toFixed(4) || '1.0000'}</td>
                  <td className="py-3 pr-4">{c.isBase ? <Badge className="bg-primary">Base Currency</Badge> : <Badge variant="outline">Active</Badge>}</td>
                  <td className="py-3 pr-4 text-right">
                    {!c.isBase && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateRate(c.id, c.code)}>Update Rate</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBase(c.id, c.code)}>Set as Base</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h4 className="font-semibold text-sm">How Multi-Currency Works</h4>
            <p className="text-xs text-muted-foreground mt-1">Your base currency is used for all accounting and reports. When you create orders or payments in a different currency, the system converts amounts using the latest exchange rate. Update rates regularly for accurate financials.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============ Numbering Tab ============
function NumberingTab() {
  const [settings, setSettings] = useState<any>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<any>({})

  const loadData = () => fetch('/api/erp/numbering').then(r => r.json()).then(d => {
    if (d.settings) {
      setSettings(d.settings)
      setPreviews(d.previews || {})
      setForm({
        salesOrderPrefix: d.settings.salesOrderPrefix,
        salesOrderStart: d.settings.salesOrderStart,
        purchaseOrderPrefix: d.settings.purchaseOrderPrefix,
        purchaseOrderStart: d.settings.purchaseOrderStart,
        invoicePrefix: d.settings.invoicePrefix,
        invoiceStart: d.settings.invoiceStart,
        customerPrefix: d.settings.customerPrefix,
        customerStart: d.settings.customerStart,
        supplierPrefix: d.settings.supplierPrefix,
        supplierStart: d.settings.supplierStart,
        productPrefix: d.settings.productPrefix,
        productStart: d.settings.productStart,
        employeePrefix: d.settings.employeePrefix,
        employeeStart: d.settings.employeeStart,
        transactionPrefix: d.settings.transactionPrefix,
        transactionStart: d.settings.transactionStart,
      })
    }
  })
  useEffect(() => { loadData() }, [])

  async function save() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/numbering', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess('Numbering settings saved'); loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!settings) return <Card className="h-32 animate-pulse bg-muted/40" />

  const ENTITIES = [
    { key: 'salesOrder', label: 'Sales Orders', icon: '🛒' },
    { key: 'purchaseOrder', label: 'Purchase Orders', icon: '📦' },
    { key: 'invoice', label: 'Invoices', icon: '🧾' },
    { key: 'customer', label: 'Customers', icon: '👤' },
    { key: 'supplier', label: 'Suppliers', icon: '🏭' },
    { key: 'product', label: 'Products / SKU', icon: '🏷️' },
    { key: 'employee', label: 'Employees', icon: '👷' },
    { key: 'transaction', label: 'Transactions', icon: '💰' },
  ]

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5"><Database className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold">Document Numbering & Prefixes</h4>
            <p className="text-xs text-muted-foreground">Customize how your order numbers, customer codes, SKUs, etc. are generated</p>
          </div>
        </div>

        <div className="space-y-3">
          {ENTITIES.map(entity => (
            <div key={entity.key} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border border-border/60">
              <div className="col-span-12 sm:col-span-3">
                <Label className="text-xs">{entity.icon} {entity.label}</Label>
                <div className="mt-1 text-sm font-mono text-primary">{previews[entity.key] || '—'}</div>
                <p className="text-[10px] text-muted-foreground">Next number preview</p>
              </div>
              <div className="col-span-7 sm:col-span-5">
                <Label className="text-xs">Prefix</Label>
                <Input value={form[`${entity.key}Prefix`] || ''} onChange={e => setForm({ ...form, [`${entity.key}Prefix`]: e.target.value })} className="font-mono" />
              </div>
              <div className="col-span-5 sm:col-span-4">
                <Label className="text-xs">Starting #</Label>
                <Input type="number" value={form[`${entity.key}Start`] || 0} onChange={e => setForm({ ...form, [`${entity.key}Start`]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⚠️ Changing the starting number only affects NEW records. Existing records keep their current numbers.</p>
          <Button onClick={save} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save Settings</Button>
        </div>
      </Card>
    </div>
  )
}

// ============ Backup Tab ============
function BackupTab() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadBackup(file: File) {
    setUploading(true); setError(''); setSuccess('')
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      const res = await fetch('/api/erp/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ backup }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Imported: ${d.imported?.products || 0} products, ${d.imported?.customers || 0} customers, ${d.imported?.suppliers || 0} suppliers, ${d.imported?.employees || 0} employees, ${d.imported?.transactions || 0} transactions`)
    } catch (e: any) { setError('Invalid file: ' + e.message) } finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3"><div className="rounded-lg bg-primary/10 p-2.5"><Download className="h-5 w-5 text-primary" /></div><div><h4 className="font-semibold">Export Backup</h4><p className="text-xs text-muted-foreground">Download all your tenant data as JSON</p></div></div>
          <p className="text-xs text-muted-foreground mb-4">Includes all products, customers, suppliers, orders, POs, employees, transactions. Excludes password hashes.</p>
          <Button onClick={() => window.location.href = '/api/erp/backup'} className="w-full"><Download className="h-4 w-4 mr-2" /> Download Backup</Button>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3"><div className="rounded-lg bg-amber-50 p-2.5"><Upload className="h-5 w-5 text-amber-600" /></div><div><h4 className="font-semibold">Restore Backup</h4><p className="text-xs text-muted-foreground">Import data from a previous backup</p></div></div>
          <p className="text-xs text-muted-foreground mb-4">Merges new records into your tenant (skips duplicates by SKU/email/name).</p>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBackup(f); e.target.value = '' }} />
          <Button variant="outline" className="w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}{uploading ? 'Importing...' : 'Upload & Restore'}</Button>
        </Card>
      </div>
    </div>
  )
}

// ============ Custom Fields Manager ============
const FIELD_TYPE_OPTIONS = [
  'text', 'number', 'date', 'select', 'textarea', 'checkbox', 'url', 'email', 'phone', 'formula', 'calculated',
]

const FORMULA_TYPE_OPTIONS = [
  'age_from_ic', 'age_from_dob', 'age_from_ic_or_dob', 'ic_gender', 'ic_dob', 'expression',
]

const MODULE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'product', label: 'Product' },
  { value: 'order', label: 'Sales Order' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'employee', label: 'Employee' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'warehouse', label: 'Warehouse' },
]

const PRESET_OPTIONS = [
  { key: 'medical_products', label: 'Medical / Pharmacy', icon: Stethoscope },
  { key: 'hotel_products', label: 'Hotel / Hospitality', icon: Building2 },
  { key: 'tailor_products', label: 'Tailor / Fashion', icon: Shirt },
]

function CustomFieldsManager() {
  const [fields, setFields] = useState<any[]>([])
  const [module, setModule] = useState('product')
  const [presets, setPresets] = useState<any[]>([])
  const [fieldTypes] = useState(FIELD_TYPE_OPTIONS)
  const [formulaTypes] = useState(FORMULA_TYPE_OPTIONS)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({ label: '', type: 'text', options: '', defaultValue: '', formula: '', formulaType: '', sourceField: '', isRequired: false, showInTable: true, showInForm: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = () => fetch(`/api/erp/custom-fields?module=${module}`).then(r => r.json()).then(d => {
    setFields(d.fields || [])
    setPresets(d.presets || [])
  })
  useEffect(() => { loadData() }, [module])

  function resetForm() {
    setForm({ label: '', type: 'text', options: '', defaultValue: '', formula: '', formulaType: '', sourceField: '', isRequired: false, showInTable: true, showInForm: true })
  }

  async function createField() {
    setLoading(true); setError('')
    try {
      const body: any = { module, label: form.label, type: form.type, defaultValue: form.defaultValue || undefined, isRequired: form.isRequired, showInTable: form.showInTable, showInForm: form.showInForm }
      if (form.type === 'select') body.options = form.options.split(',').map(s => s.trim()).filter(Boolean)
      if (form.type === 'formula' || form.type === 'calculated') {
        body.formula = form.formula || undefined
        body.formulaType = form.formulaType || undefined
        body.sourceField = form.sourceField || undefined
      }
      const res = await fetch('/api/erp/custom-fields', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setShowCreate(false); resetForm(); loadData()
      setSuccess('Field created')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function updateField() {
    if (!editing) return
    setLoading(true); setError('')
    try {
      const body: any = { label: form.label, type: form.type, defaultValue: form.defaultValue || undefined, isRequired: form.isRequired, showInTable: form.showInTable, showInForm: form.showInForm }
      if (form.type === 'select') body.options = form.options.split(',').map(s => s.trim()).filter(Boolean)
      if (form.type === 'formula' || form.type === 'calculated') {
        body.formula = form.formula || undefined
        body.formulaType = form.formulaType || undefined
        body.sourceField = form.sourceField || undefined
      }
      const res = await fetch(`/api/erp/custom-fields/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEditing(null); resetForm(); loadData()
      setSuccess('Field updated')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function deleteField(id: string) {
    if (!confirm('Delete this custom field? Values stored against it will also be removed.')) return
    await fetch(`/api/erp/custom-fields/${id}`, { method: 'DELETE' })
    loadData()
  }

  async function applyPreset(key: string) {
    if (!confirm(`Apply the "${key}" preset? This will add multiple custom fields to the ${module} module.`)) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/erp/custom-fields?applyPreset=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Preset applied: ${d.added || 0} fields added`)
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function startEdit(f: any) {
    setEditing(f)
    setShowCreate(false)
    const opts = (() => {
      if (!f.options) return ''
      try {
        const p = JSON.parse(f.options)
        return Array.isArray(p) ? p.join(', ') : ''
      } catch { return String(f.options) }
    })()
    setForm({
      label: f.label,
      type: f.type,
      options: opts,
      defaultValue: f.defaultValue || '',
      formula: f.formula || '',
      formulaType: f.formulaType || '',
      sourceField: f.sourceField || '',
      isRequired: !!f.isRequired,
      showInTable: f.showInTable !== false,
      showInForm: f.showInForm !== false,
    })
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Module selector */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Module</Label>
            <select
              className="mt-1 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={module}
              onChange={e => setModule(e.target.value)}
            >
              {MODULE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(true); setEditing(null); resetForm() }}><Plus className="h-4 w-4 mr-2" />Add Field</Button>
        </div>

        {/* Preset buttons (only for product module) */}
        {module === 'product' && presets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <FolderInput className="h-3.5 w-3.5" /> Industry presets
            </p>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => {
                const meta = PRESET_OPTIONS.find(x => x.key === p.key)
                const Icon = meta?.icon || FolderInput
                return (
                  <Button key={p.key} size="sm" variant="outline" disabled={loading} onClick={() => applyPreset(p.key)}>
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {meta?.label || p.label}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{p.fieldCount} fields</Badge>
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit panel */}
      {(showCreate || editing) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              {editing ? <><Pencil className="h-4 w-4" />Edit Field</> : <><Plus className="h-4 w-4" />New Custom Field</>}
            </h4>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowCreate(false); setEditing(null); resetForm() }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label *</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Allergies" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                {fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.type === 'select' && (
              <div className="col-span-2">
                <Label className="text-xs">Options (comma-separated)</Label>
                <Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="Option 1, Option 2, Option 3" />
              </div>
            )}
            {(form.type === 'formula' || form.type === 'calculated') && (
              <>
                <div>
                  <Label className="text-xs">Formula Type</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.formulaType}
                    onChange={e => setForm({ ...form, formulaType: e.target.value })}
                  >
                    <option value="">—</option>
                    {formulaTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Source Field (key)</Label>
                  <Input value={form.sourceField} onChange={e => setForm({ ...form, sourceField: e.target.value })} placeholder="idNumber or dateOfBirth" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Expression (only for `expression` formula type)</Label>
                  <Input value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value })} placeholder="{qty} * {price}" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Default Value</Label>
              <Input value={form.defaultValue} onChange={e => setForm({ ...form, defaultValue: e.target.value })} />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.isRequired} onChange={e => setForm({ ...form, isRequired: e.target.checked })} />
                Required
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.showInForm} onChange={e => setForm({ ...form, showInForm: e.target.checked })} />
                Show in form
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.showInTable} onChange={e => setForm({ ...form, showInTable: e.target.checked })} />
                Show in table
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={editing ? updateField : createField} disabled={loading || !form.label}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? 'Update Field' : 'Create Field'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm() }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Fields list */}
      <SectionCard title={`${MODULE_OPTIONS.find(m => m.value === module)?.label || module} Fields`} subtitle={`${fields.length} fields`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Label</th>
                <th className="pb-2 pr-4 font-medium">Key</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Required</th>
                <th className="pb-2 pr-4 font-medium">Visibility</th>
                <th className="pb-2 pr-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4 font-medium">{f.label}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{f.fieldKey}</td>
                  <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{f.type}</Badge></td>
                  <td className="py-2 pr-4">{f.isRequired && <Check className="h-3.5 w-3.5 text-emerald-600" />}</td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {f.showInForm ? 'Form ' : ''}{f.showInTable ? '· Table' : ''}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => startEdit(f)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => deleteField(f.id)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fields.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No custom fields yet for this module</div>}
        </div>
      </SectionCard>
    </div>
  )
}

// ============ Invoice Design Tab ============
function InvoiceTemplateTab() {
  const [template, setTemplate] = useState<any>(null)
  const [patientCustomFields, setPatientCustomFields] = useState<any[]>([])
  const [availableCustomFields, setAvailableCustomFields] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = () => {
    fetch('/api/erp/invoice-template').then(r => r.json()).then(d => {
      if (d.template) {
        setTemplate(d.template)
        setPatientCustomFields(d.template.patientCustomFields || [])
      }
    })
    fetch('/api/erp/custom-fields?module=customer').then(r => r.json()).then(d => {
      setAvailableCustomFields(d.fields || [])
    })
  }
  useEffect(() => { loadData() }, [])

  async function update(patch: any) {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/invoice-template', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setTemplate(d.template)
      setPatientCustomFields(d.template.patientCustomFields || [])
      setSuccess('Saved')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function togglePatientField(fieldKey: string) {
    const has = patientCustomFields.some((f: any) => f.fieldKey === fieldKey)
    const next = has
      ? patientCustomFields.filter((f: any) => f.fieldKey !== fieldKey)
      : [...patientCustomFields, availableCustomFields.find(f => f.fieldKey === fieldKey)]
    // Call update on BOTH paths so the tick/untick always persists server-side.
    setPatientCustomFields(next)
    update({ patientCustomFields: next })
  }

  if (!template) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Pointer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4 border-dashed">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><Stethoscope className="h-4 w-4 text-amber-600" /></div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Service Form Designer</h4>
              <p className="text-xs text-muted-foreground mt-1">Build your industry-specific service / encounter form (clinical, hotel check-in, tailor measurement, etc.) that flows into the invoice.</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-dashed">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Files className="h-4 w-4 text-blue-600" /></div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Document Templates</h4>
              <p className="text-xs text-muted-foreground mt-1">Customize quotations, receipts, purchase orders, delivery notes and more in the Document Templates tab.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Clinic / business header */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5"><Building2 className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold">Header & Branding</h4>
            <p className="text-xs text-muted-foreground">Top-of-invoice business identity</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Clinic / Business Name</Label><Input value={template.clinicName || ''} onChange={e => setTemplate({ ...template, clinicName: e.target.value })} /></div>
          <div><Label className="text-xs">Phone</Label><Input value={template.clinicPhone || ''} onChange={e => setTemplate({ ...template, clinicPhone: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">Address</Label><Textarea value={template.clinicAddress || ''} onChange={e => setTemplate({ ...template, clinicAddress: e.target.value })} rows={2} /></div>
          <div><Label className="text-xs">Invoice Label (e.g. INVOICE / RECEIPT)</Label><Input value={template.invoiceLabel || ''} onChange={e => setTemplate({ ...template, invoiceLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Total Label (e.g. TOTAL TO PAY)</Label><Input value={template.totalLabel || ''} onChange={e => setTemplate({ ...template, totalLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Primary Color</Label><Input value={template.primaryColor || ''} onChange={e => setTemplate({ ...template, primaryColor: e.target.value })} placeholder="#263373" /></div>
          <div><Label className="text-xs">Font Size</Label><Input value={template.fontSize || ''} onChange={e => setTemplate({ ...template, fontSize: e.target.value })} placeholder="12px" /></div>
          <div><Label className="text-xs">Currency Symbol</Label><Input value={template.currencySymbol || ''} onChange={e => setTemplate({ ...template, currencySymbol: e.target.value })} placeholder="RM" /></div>
          <div><Label className="text-xs">Footer Text</Label><Input value={template.footerText || ''} onChange={e => setTemplate({ ...template, footerText: e.target.value })} /></div>
        </div>
      </Card>

      {/* Patient info section */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-purple-50 p-2.5"><Users className="h-5 w-5 text-purple-600" /></div>
          <div>
            <h4 className="font-semibold">Patient Info Block</h4>
            <p className="text-xs text-muted-foreground">Choose what appears in the patient info panel</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!template.showPatientIC} onChange={e => { setTemplate({ ...template, showPatientIC: e.target.checked }); update({ showPatientIC: e.target.checked }) }} />
            Show IC / Passport
          </label>
          <div><Label className="text-xs">IC Label</Label><Input value={template.patientICLabel || ''} onChange={e => setTemplate({ ...template, patientICLabel: e.target.value })} /></div>
        </div>
        <div className="border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Additional custom fields to show on the invoice (from Customer module):</p>
          {availableCustomFields.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No customer custom fields defined. Add some in the Fields tab to show them here.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableCustomFields.map(f => {
                const selected = patientCustomFields.some((p: any) => p.fieldKey === f.fieldKey)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => togglePatientField(f.fieldKey)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      selected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className={`flex items-center justify-center h-4 w-4 rounded border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{f.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Line items column labels */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-emerald-50 p-2.5"><Receipt className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h4 className="font-semibold">Line Items</h4>
            <p className="text-xs text-muted-foreground">Customize column headers</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Item Column</Label><Input value={template.itemColLabel || ''} onChange={e => setTemplate({ ...template, itemColLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Price Column</Label><Input value={template.priceColLabel || ''} onChange={e => setTemplate({ ...template, priceColLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Qty Column</Label><Input value={template.unitColLabel || ''} onChange={e => setTemplate({ ...template, unitColLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Amount Column</Label><Input value={template.amountColLabel || ''} onChange={e => setTemplate({ ...template, amountColLabel: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer col-span-2">
            <input type="checkbox" checked={!!template.showItemNumbers} onChange={e => { setTemplate({ ...template, showItemNumbers: e.target.checked }); update({ showItemNumbers: e.target.checked }) }} />
            Show row numbers
          </label>
        </div>
      </Card>

      {/* Order notes card — neutral wording, off by default */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-lg bg-slate-100 p-2.5"><FileText className="h-5 w-5 text-slate-600" /></div>
          <div className="flex-1">
            <h4 className="font-semibold">Order Notes on Invoice</h4>
            <p className="text-xs text-muted-foreground">Optionally print order notes / comments on the invoice</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!template.showClinicalNotes} onChange={e => { setTemplate({ ...template, showClinicalNotes: e.target.checked }); update({ showClinicalNotes: e.target.checked }) }} />
            Show
          </label>
        </div>
        <div><Label className="text-xs">Notes Section Label</Label><Input value={template.notesLabel || ''} onChange={e => setTemplate({ ...template, notesLabel: e.target.value })} /></div>
      </Card>

      {/* Payment QR */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-lg bg-blue-50 p-2.5"><Smartphone className="h-5 w-5 text-blue-600" /></div>
          <div className="flex-1">
            <h4 className="font-semibold">DuitNow / QR Payment Block</h4>
            <p className="text-xs text-muted-foreground">Show a QR payment block on the invoice when balance is due</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!template.showPaymentQR} onChange={e => { setTemplate({ ...template, showPaymentQR: e.target.checked }); update({ showPaymentQR: e.target.checked }) }} />
            Show
          </label>
        </div>
        <div><Label className="text-xs">Payment Instructions</Label><Textarea value={template.paymentInstructions || ''} onChange={e => setTemplate({ ...template, paymentInstructions: e.target.value })} rows={2} /></div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => update({
          clinicName: template.clinicName,
          clinicPhone: template.clinicPhone,
          clinicAddress: template.clinicAddress,
          invoiceLabel: template.invoiceLabel,
          totalLabel: template.totalLabel,
          primaryColor: template.primaryColor,
          fontSize: template.fontSize,
          currencySymbol: template.currencySymbol,
          footerText: template.footerText,
          patientICLabel: template.patientICLabel,
          itemColLabel: template.itemColLabel,
          priceColLabel: template.priceColLabel,
          unitColLabel: template.unitColLabel,
          amountColLabel: template.amountColLabel,
          notesLabel: template.notesLabel,
          paymentInstructions: template.paymentInstructions,
        })} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save All Changes
        </Button>
      </div>
    </div>
  )
}
