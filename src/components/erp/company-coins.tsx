'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Coins, AlertCircle, CheckCircle2, Award, TrendingUp, Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { formatNumber, formatDate } from './lib'

export function CompanyCoinsTab() {
  const [config, setConfig] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [companyBalance, setCompanyBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [ordersLabel, setOrdersLabel] = useState('Sales Order')

  useEffect(() => {
    Promise.all([
      fetch('/api/erp/rewards/config').then(r => r.json()),
      fetch('/api/erp/rewards/tasks').then(r => r.json()),
      fetch('/api/erp/rewards/balance').then(r => r.json()),
      fetch('/api/erp/module-labels').then(r => r.ok ? r.json() : { labels: [] }),
    ]).then(([c, t, b, ml]) => {
      setConfig(c.config)
      setTasks(t.tasks || [])
      setCompanyBalance(c.companyBalance || 0)
      setTransactions(b.transactions || [])
      const labelsArr = Array.isArray(ml) ? ml : (ml?.labels || [])
      const ol = labelsArr.find((l: any) => l.moduleKey === 'orders')
      if (ol?.label) setOrdersLabel(ol.label)
    }).finally(() => setLoading(false))
  }, [])

  async function saveConfig() {
    setSaving(true); setSuccess('')
    try {
      await fetch('/api/erp/rewards/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSuccess('Saved')
      setTimeout(() => setSuccess(''), 2000)
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-4">
      {/* Company Balance */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500 p-3 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium uppercase">Company Nex Coin Balance</p>
              <p className="text-3xl font-bold text-amber-900">{formatNumber(companyBalance)}</p>
              <p className="text-xs text-muted-foreground">Platform grants coins to this company. Distribute to employees via tasks.</p>
            </div>
          </div>
        </div>
      </Card>

      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Reward Config */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Reward Configuration</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-medium">{config?.isEnabled ? 'Enabled' : 'Disabled'}</span>
            <input type="checkbox" checked={!!config?.isEnabled} onChange={e => setConfig({ ...config, isEnabled: e.target.checked })} className="accent-primary h-5 w-5" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Coins per {ordersLabel}</Label>
            <Input type="number" value={config?.pointsPerVisit || 10} onChange={e => setConfig({ ...config, pointsPerVisit: parseInt(e.target.value) || 0 })} />
            <p className="text-[10px] text-muted-foreground">Only applies if a "{ordersLabel} Created" task exists</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Coins Label</Label>
            <Input value={config?.pointsLabel || 'Nex Coins'} onChange={e => setConfig({ ...config, pointsLabel: e.target.value })} />
          </div>
        </div>
        <Button size="sm" onClick={saveConfig} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save Configuration
        </Button>
      </Card>

      {/* Reward Tasks — with Add Task button */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Award className="h-4 w-4" /> Reward Tasks ({tasks.length})</h4>
          <Button size="sm" variant="outline" onClick={() => { setEditingTask(null); setShowTaskForm(!showTaskForm) }}>
            {showTaskForm ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Add Task</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Define how employees earn Nex Coins. "Auto" tasks trigger automatically; "Manual" tasks are awarded by admins.</p>

        {showTaskForm && (
          <TaskForm
            task={editingTask}
            ordersLabel={ordersLabel}
            onSaved={() => {
              setShowTaskForm(false); setEditingTask(null)
              fetch('/api/erp/rewards/tasks').then(r => r.json()).then(d => setTasks(d.tasks || []))
            }}
          />
        )}

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No tasks configured. Click "Add Task" to create one.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <p className="font-medium">{t.name} {!t.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">{t.description || ''} · {t.triggerType === 'visit_created' ? '⚡ Automatic' : '👤 Manual'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-700">{t.points} NC</span>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingTask(t); setShowTaskForm(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-rose-600" onClick={async () => {
                    if (!confirm(`Delete task "${t.name}"?`)) return
                    await fetch(`/api/erp/rewards/tasks/${t.id}`, { method: 'DELETE' })
                    fetch('/api/erp/rewards/tasks').then(r => r.json()).then(d => setTasks(d.tasks || []))
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Company Coin Transactions */}
      <Card className="p-5 space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Recent Coin Transactions</h4>
        <p className="text-xs text-muted-foreground">All Nex Coin transactions for this company (awards, redemptions, adjustments).</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)} · {t.type}</p>
                </div>
                <span className={`font-bold tabular-nums ${t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ============ Task Form ============
function TaskForm({ task, ordersLabel, onSaved }: { task: any; ordersLabel: string; onSaved: () => void }) {
  const [name, setName] = useState(task?.name || '')
  const [description, setDescription] = useState(task?.description || '')
  const [points, setPoints] = useState(String(task?.points || 10))
  const [triggerType, setTriggerType] = useState(task?.triggerType || 'manual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const body = { name, description, points: parseInt(points), triggerType }
      const url = task ? `/api/erp/rewards/tasks/${task.id}` : '/api/erp/rewards/tasks'
      const method = task ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Task Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Patient Referral" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Coins *</Label>
          <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Trigger Type</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerType} onChange={e => setTriggerType(e.target.value)}>
            <option value="manual">Manual (admin awards)</option>
            <option value="visit_created">Auto: {ordersLabel} Created</option>
            <option value="monthly_bonus">Monthly Bonus</option>
            <option value="referral">Referral</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What the task involves" />
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={saving || !name}>
        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        {task ? 'Save Changes' : 'Create Task'}
      </Button>
    </div>
  )
}
