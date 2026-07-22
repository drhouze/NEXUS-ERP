'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard, StatusBadge } from './shared'
import { formatDate, relativeTime } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Workflow as WorkflowIcon, Plus, Loader2, AlertCircle, Zap, Mail, Bell, CheckCircle2,
  Trash2, Play, Pause, ArrowRight,
} from 'lucide-react'

const TRIGGERS = [
  { value: 'order.created', label: 'When a sales order is created', icon: '🛒' },
  { value: 'order.delivered', label: 'When an order is delivered', icon: '📦' },
  { value: 'payment.received', label: 'When a payment is received', icon: '💰' },
  { value: 'po.received', label: 'When a PO is received', icon: '🏭' },
  { value: 'low_stock', label: 'When stock is low', icon: '⚠️' },
  { value: 'manual', label: 'Manual trigger only', icon: '✋' },
]

const STEP_TYPES = [
  { value: 'send_notification', label: 'Send In-App Notification', icon: Bell },
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'create_task', label: 'Create Task', icon: CheckCircle2 },
  { value: 'call_webhook', label: 'Call Webhook', icon: Zap },
  { value: 'wait', label: 'Wait', icon: ArrowRight },
]

export function WorkflowModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)

  const loadData = () => fetch('/api/erp/workflows').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  async function toggleActive(workflowId: string, isActive: boolean) {
    await fetch('/api/erp/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowId, isActive: !isActive }) })
    loadData()
  }

  async function deleteWorkflow(workflowId: string) {
    if (!confirm('Delete this workflow?')) return
    await fetch(`/api/erp/workflows?id=${workflowId}`, { method: 'DELETE' })
    loadData()
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-700 text-white border-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <WorkflowIcon className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Automation</span>
            </div>
            <h2 className="text-2xl font-bold">Workflow Builder</h2>
            <p className="text-sm opacity-90 mt-1">Automate your business processes — trigger actions when events happen.</p>
          </div>
          <Button className="bg-white text-purple-700 hover:bg-white/90" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Workflow
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Active Workflows</p>
          <p className="text-2xl font-bold text-emerald-600">{data.workflows?.filter((w: any) => w.isActive).length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Executions</p>
          <p className="text-2xl font-bold">{data.recentExecutions?.length || 0}</p>
        </Card>
      </div>

      <SectionCard title="Workflows" subtitle={`${data.workflows?.length || 0} workflows`}>
        <div className="space-y-3">
          {data.workflows?.map((w: any) => (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <WorkflowIcon className="h-4 w-4 text-purple-500" />
                    <h4 className="font-semibold">{w.name}</h4>
                    <Badge className={w.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {w.isActive ? 'Active' : 'Paused'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{TRIGGERS.find(t => t.value === w.trigger)?.icon} {w.trigger}</Badge>
                  </div>
                  {w.description && <p className="text-xs text-muted-foreground mb-2">{w.description}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    {w.steps.map((s: any, i: number) => {
                      const stepType = STEP_TYPES.find(t => t.value === s.type)
                      const Icon = stepType?.icon || Zap
                      return (
                        <div key={s.id} className="flex items-center gap-1">
                          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
                          <Badge variant="outline" className="text-xs py-1">
                            <Icon className="h-3 w-3 mr-1" />
                            {stepType?.label || s.type}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{w._count?.executions || 0} executions</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(w.id, w.isActive)}>
                    {w.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => deleteWorkflow(w.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {(!data.workflows || data.workflows.length === 0) && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <WorkflowIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No workflows yet. Create one to automate your processes.
            </div>
          )}
        </div>
      </SectionCard>

      {data.recentExecutions?.length > 0 && (
        <SectionCard title="Recent Executions" subtitle={`${data.recentExecutions.length} recent`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Workflow</th>
                <th className="pb-2 pr-4 font-medium">Trigger</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Steps</th>
                <th className="pb-2 pr-4 font-medium">When</th>
              </tr></thead>
              <tbody>
                {data.recentExecutions.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4 font-medium">{e.workflow?.name || '—'}</td>
                    <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{e.trigger}</Badge></td>
                    <td className="py-2 pr-4">
                      <Badge className={e.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : e.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{e.stepsDone}/{e.stepsTotal}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{relativeTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {showForm && <WorkflowFormDialog onClose={() => setShowForm(false)} onDone={loadData} />}
    </div>
  )
}

function WorkflowFormDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trigger, setTrigger] = useState('order.created')
  const [steps, setSteps] = useState<any[]>([{ type: 'send_notification', config: { title: 'New Order', message: 'A new order has been created', notificationType: 'info', category: 'order' } }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addStep() {
    setSteps([...steps, { type: 'send_notification', config: {} }])
  }

  function updateStep(i: number, field: string, value: any) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function updateStepConfig(i: number, key: string, value: string) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, config: { ...s.config, [key]: value } } : s))
  }

  async function submit() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/erp/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, trigger, steps }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onDone(); onClose()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><WorkflowIcon className="h-5 w-5" /> Create Workflow</DialogTitle>
          <DialogDescription>Define a trigger and a chain of automated steps</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Order Alert" /></div>
            <div><Label className="text-xs">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this workflow do?" /></div>
          </div>
          <div>
            <Label className="text-xs">Trigger *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TRIGGERS.map(t => (
                <button key={t.value} onClick={() => setTrigger(t.value)} className={`flex items-center gap-2 p-2 rounded-lg border text-sm text-left ${trigger === t.value ? 'border-purple-500 bg-purple-50' : 'border-border'}`}>
                  <span>{t.icon}</span>
                  <span className="text-xs">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Steps (executed in order)</Label>
              <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Add Step</Button>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const Icon = STEP_TYPES.find(t => t.value === s.type)?.icon || Zap
                return (
                  <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs"><Icon className="h-3 w-3 mr-1" />Step {i + 1}</Badge>
                      {steps.length > 1 && <Button size="sm" variant="ghost" className="text-rose-500 h-6 w-6 p-0" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}>×</Button>}
                    </div>
                    <div>
                      <Label className="text-xs">Action Type</Label>
                      <select className="w-full p-2 rounded border border-border text-sm mt-1" value={s.type} onChange={e => updateStep(i, 'type', e.target.value)}>
                        {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {/* Dynamic config fields based on step type */}
                    {s.type === 'send_notification' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Title</Label><Input value={s.config.title || ''} onChange={e => updateStepConfig(i, 'title', e.target.value)} /></div>
                        <div><Label className="text-xs">Category</Label><Input value={s.config.category || ''} onChange={e => updateStepConfig(i, 'category', e.target.value)} /></div>
                        <div className="col-span-2"><Label className="text-xs">Message</Label><Input value={s.config.message || ''} onChange={e => updateStepConfig(i, 'message', e.target.value)} /></div>
                      </div>
                    )}
                    {s.type === 'send_email' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Recipient Email</Label><Input value={s.config.recipientEmail || ''} onChange={e => updateStepConfig(i, 'recipientEmail', e.target.value)} /></div>
                        <div><Label className="text-xs">Subject</Label><Input value={s.config.subject || ''} onChange={e => updateStepConfig(i, 'subject', e.target.value)} /></div>
                        <div className="col-span-2"><Label className="text-xs">Body</Label><Input value={s.config.body || ''} onChange={e => updateStepConfig(i, 'body', e.target.value)} /></div>
                      </div>
                    )}
                    {s.type === 'create_task' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Task Title</Label><Input value={s.config.taskTitle || ''} onChange={e => updateStepConfig(i, 'taskTitle', e.target.value)} /></div>
                        <div><Label className="text-xs">Description</Label><Input value={s.config.taskDescription || ''} onChange={e => updateStepConfig(i, 'taskDescription', e.target.value)} /></div>
                      </div>
                    )}
                    {s.type === 'call_webhook' && (
                      <div><Label className="text-xs">Webhook URL</Label><Input value={s.config.url || ''} onChange={e => updateStepConfig(i, 'url', e.target.value)} placeholder="https://..." /></div>
                    )}
                    {s.type === 'wait' && (
                      <div><Label className="text-xs">Wait Seconds</Label><Input type="number" value={s.config.seconds || ''} onChange={e => updateStepConfig(i, 'seconds', e.target.value)} /></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading || !name}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Create Workflow</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
