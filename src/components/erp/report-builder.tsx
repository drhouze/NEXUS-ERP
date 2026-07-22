'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard } from './shared'
import { formatCurrency, formatNumber } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, Play, Database } from 'lucide-react'

const DATA_SOURCES = [
  { id: 'products', label: 'Products', fields: ['name', 'sku', 'category', 'price', 'cost', 'stockQty', 'reorderLevel'] },
  { id: 'orders', label: 'Sales Orders', fields: ['orderNumber', 'status', 'total', 'paidAmount', 'createdAt'] },
  { id: 'customers', label: 'Customers', fields: ['name', 'company', 'email', 'phone', 'status', 'totalSpent'] },
  { id: 'transactions', label: 'Transactions', fields: ['type', 'category', 'amount', 'description', 'date'] },
  { id: 'employees', label: 'Employees', fields: ['name', 'email', 'department', 'role', 'salary', 'status'] },
  { id: 'suppliers', label: 'Suppliers', fields: ['name', 'contactName', 'email', 'country', 'rating'] },
]

export function ReportBuilderModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [dataSource, setDataSource] = useState('products')
  const [fields, setFields] = useState<string[]>(['name', 'sku', 'category', 'price', 'stockQty'])
  const [groupBy, setGroupBy] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [limit, setLimit] = useState('100')
  const [results, setResults] = useState<any[]>([])
  const [grouped, setGrouped] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const availableFields = DATA_SOURCES.find(d => d.id === dataSource)?.fields || []

  async function runReport() {
    setLoading(true); setHasRun(true)
    try {
      const res = await fetch('/api/erp/reports-builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSource, fields, groupBy: groupBy || null, sortBy: sortBy ? { field: sortBy, direction: sortDir } : null, limit }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setResults(d.results || [])
      setGrouped(d.grouped)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function exportCsv() {
    if (results.length === 0) return
    const headers = Object.keys(results[0]).filter(k => typeof results[0][k] !== 'object')
    const rows = results.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${dataSource}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleField(field: string) {
    setFields(fields.includes(field) ? fields.filter(f => f !== field) : [...fields, field])
  }

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1"><Database className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider opacity-90">Analytics</span></div>
          <h2 className="text-2xl font-bold">Custom Report Builder</h2>
          <p className="text-sm opacity-90 mt-1">Build custom reports from any data source. Filter, group, sort, and export to CSV.</p>
        </div>
      </Card>

      <SectionCard title="Report Configuration">
        <div className="space-y-4">
          {/* Data source */}
          <div>
            <Label className="text-xs mb-2 block">Data Source</Label>
            <div className="flex flex-wrap gap-2">
              {DATA_SOURCES.map(ds => (
                <button key={ds.id} onClick={() => { setDataSource(ds.id); setFields(ds.fields.slice(0, 5)) }} className={`px-3 py-1.5 rounded-lg border text-sm ${dataSource === ds.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-border'}`}>
                  {ds.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div>
            <Label className="text-xs mb-2 block">Fields to Include</Label>
            <div className="flex flex-wrap gap-2">
              {availableFields.map(f => (
                <button key={f} onClick={() => toggleField(f)} className={`px-2 py-1 rounded text-xs ${fields.includes(f) ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-muted text-muted-foreground border border-border'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Group By</Label><Select value={groupBy || '__none__'} onValueChange={v => setGroupBy(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="__none__">None</SelectItem>{availableFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Sort By</Label><Select value={sortBy || '__none__'} onValueChange={v => setSortBy(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="__none__">None</SelectItem>{availableFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Direction</Label><Select value={sortDir} onValueChange={setSortDir}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Ascending</SelectItem><SelectItem value="desc">Descending</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Limit</Label><Input type="number" value={limit} onChange={e => setLimit(e.target.value)} /></div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runReport} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Run Report</Button>
            {results.length > 0 && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>}
          </div>
        </div>
      </SectionCard>

      {/* Grouped results */}
      {grouped && (
        <SectionCard title="Grouped Summary" subtitle={`${grouped.length} groups`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60"><th className="pb-2 pr-4 font-medium">Group</th><th className="pb-2 pr-4 font-medium text-right">Count</th><th className="pb-2 pr-4 font-medium text-right">Total</th></tr></thead>
              <tbody>
                {grouped.map((g: any) => (
                  <tr key={g.key} className="border-b border-border/40"><td className="py-2 pr-4 font-medium">{g.key}</td><td className="py-2 pr-4 text-right tabular-nums">{g.count}</td><td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(g.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Results table */}
      {hasRun && (
        <SectionCard title="Results" subtitle={`${results.length} records`}>
          {results.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No results. Adjust your filters and try again.</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    {Object.keys(results[0]).filter(k => typeof results[0][k] !== 'object').map(f => (
                      <th key={f} className="pb-2 pr-4 font-medium capitalize">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      {Object.entries(r).filter(([_, v]) => typeof v !== 'object').map(([k, v]) => (
                        <td key={k} className="py-2 pr-4">
                          {k === 'total' || k === 'price' || k === 'cost' || k === 'amount' || k === 'salary' || k === 'paidAmount' || k === 'totalSpent'
                            ? <span className="tabular-nums">{formatCurrency(Number(v) || 0)}</span>
                            : k === 'stockQty' || k === 'reorderLevel' || k === 'rating'
                            ? <span className="tabular-nums">{v}</span>
                            : k === 'status'
                            ? <Badge variant="outline">{String(v)}</Badge>
                            : String(v ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
