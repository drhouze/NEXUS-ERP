'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard, StatusBadge } from './shared'
import { formatNumber, formatDate, relativeTime } from './lib'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollText, Search, Download, Filter } from 'lucide-react'

interface AuditEntry {
  id: string
  tenantId: string | null
  actorId: string | null
  actorEmail: string
  actorRole: string
  action: string
  entityType: string
  entityId: string | null
  entityName: string | null
  summary: string
  metadata: string | null
  ipAddress: string | null
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-rose-100 text-rose-700',
  suspend: 'bg-amber-100 text-amber-700',
  unsuspend: 'bg-emerald-100 text-emerald-700',
  upgrade: 'bg-purple-100 text-purple-700',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
  backup_export: 'bg-indigo-100 text-indigo-700',
  backup_import: 'bg-indigo-100 text-indigo-700',
  status_change: 'bg-blue-100 text-blue-700',
  disable: 'bg-amber-100 text-amber-700',
  enable: 'bg-emerald-100 text-emerald-700',
  reset_password: 'bg-orange-100 text-orange-700',
}

const ACTION_ICONS: Record<string, string> = {
  create: '+',
  update: '✎',
  delete: '×',
  suspend: '⛔',
  unsuspend: '✓',
  upgrade: '↑',
  login: '→',
  logout: '←',
  backup_export: '↓',
  backup_import: '↑',
  status_change: '↻',
  disable: '⛔',
  enable: '✓',
  reset_password: '🔑',
}

export function AuditLogModule({ userRole = 'TENANT_ADMIN', targetTenantId }: { userRole?: string; targetTenantId?: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (actionFilter !== 'all') params.set('action', actionFilter)
    if (entityFilter !== 'all') params.set('entityType', entityFilter)
    if (targetTenantId) params.set('tenantId', targetTenantId)
    params.set('limit', '200')
    fetch(`/api/erp/audit-log?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoading(false) })
  }, [actionFilter, entityFilter, targetTenantId])

  const filtered = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(l =>
      l.summary.toLowerCase().includes(q) ||
      l.actorEmail.toLowerCase().includes(q) ||
      l.entityName?.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q)
    )
  }, [logs, search])

  function exportCsv() {
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity Name', 'Summary']
    const rows = filtered.map(l => [l.createdAt, l.actorEmail, l.actorRole, l.action, l.entityType, l.entityName || '', l.summary])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const actionTypes = Array.from(new Set(logs.map(l => l.action)))
  const entityTypes = Array.from(new Set(logs.map(l => l.entityType)))

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-slate-700 to-slate-900 text-white border-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Compliance & Security</span>
            </div>
            <h2 className="text-2xl font-bold">Audit Log</h2>
            <p className="text-sm opacity-90 mt-1">Every create, update, delete, and status change is recorded here for compliance.</p>
          </div>
          <Button variant="secondary" onClick={exportCsv} className="hidden sm:flex">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Events</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(filtered.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Creates</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{filtered.filter(l => l.action === 'create').length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Updates</p>
          <p className="text-2xl font-bold tabular-nums text-blue-600">{filtered.filter(l => ['update', 'status_change', 'upgrade'].includes(l.action)).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Deletes / Suspends</p>
          <p className="text-2xl font-bold tabular-nums text-rose-600">{filtered.filter(l => ['delete', 'suspend', 'disable'].includes(l.action)).length}</p>
        </Card>
      </div>

      <SectionCard
        title="Activity Timeline"
        subtitle={`${filtered.length} events`}
        action={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48 h-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <ScrollArea className="h-[600px] pr-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No audit entries match your filters</div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-3">
                {filtered.map((log) => (
                  <div key={log.id} className="relative pl-12 pb-3">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'}`}>
                      {ACTION_ICONS[log.action] || '•'}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'} variant="outline">
                            {log.action}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{log.entityType.replace(/_/g, ' ')}</Badge>
                          {log.entityName && <span className="text-sm font-medium">{log.entityName}</span>}
                        </div>
                        <p className="text-sm text-foreground mt-1">{log.summary}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{log.actorEmail}</span>
                          <Badge variant="secondary" className="text-[10px] py-0 h-4">{log.actorRole}</Badge>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                          <span>·</span>
                          <span title={formatDate(log.createdAt)}>{relativeTime(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SectionCard>
    </div>
  )
}
