'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard } from './shared'
import { formatCurrency, formatDate } from './lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  BookOpen, Plus, Loader2, AlertCircle, CheckCircle2, Calculator, Scale, TrendingUp, FileText,
} from 'lucide-react'

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-emerald-100 text-emerald-700',
  liability: 'bg-rose-100 text-rose-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-blue-100 text-blue-700',
  expense: 'bg-amber-100 text-amber-700',
}

export function AccountingModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-slate-700 to-slate-900 text-white border-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Accounting</span>
          </div>
          <h2 className="text-2xl font-bold">Professional Accounting</h2>
          <p className="text-sm opacity-90 mt-1">Double-entry bookkeeping, chart of accounts, trial balance, P&L, and balance sheet.</p>
        </div>
      </Card>

      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts"><ChartOfAccountsTab /></TabsContent>
        <TabsContent value="journal"><JournalTab /></TabsContent>
        <TabsContent value="trial"><TrialBalanceTab /></TabsContent>
        <TabsContent value="pnl"><ProfitLossTab /></TabsContent>
        <TabsContent value="balance"><BalanceSheetTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ============ Chart of Accounts ============
function ChartOfAccountsTab() {
  const [data, setData] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', type: 'expense', subType: '' })

  const loadData = () => fetch('/api/erp/accounting/accounts').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  async function createAccount() {
    const res = await fetch('/api/erp/accounting/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setShowForm(false); setForm({ code: '', name: '', type: 'expense', subType: '' }); loadData() }
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <SectionCard title="Chart of Accounts" subtitle={`${data.accounts?.length || 0} accounts`} action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Account</Button>}>
      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-border grid grid-cols-4 gap-3 items-end">
          <div><Label className="text-xs">Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 6800" /></div>
          <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Advertising" /></div>
          <div><Label className="text-xs">Type *</Label><select className="w-full p-2 rounded border border-border" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="flex gap-2"><Button size="sm" onClick={createAccount}>Add</Button><Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">Code</th>
            <th className="pb-2 pr-4 font-medium">Account Name</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium text-right">Balance</th>
            <th className="pb-2 pr-4 font-medium text-center">Entries</th>
          </tr></thead>
          <tbody>
            {data.accounts?.map((a: any) => (
              <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-4 font-mono font-medium">{a.code}</td>
                <td className="py-2 pr-4">{a.name}</td>
                <td className="py-2 pr-4"><Badge className={TYPE_COLORS[a.type]}>{a.type}</Badge></td>
                <td className="py-2 pr-4 text-right tabular-nums font-medium">{formatCurrency(a.balance)}</td>
                <td className="py-2 pr-4 text-center text-muted-foreground">{a._count?.journalLines || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals by type */}
      <div className="mt-4 grid grid-cols-5 gap-3">
        {ACCOUNT_TYPES.map(type => (
          <Card key={type} className="p-3">
            <p className="text-xs text-muted-foreground capitalize">{type}</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(data.totals?.[type] || 0)}</p>
          </Card>
        ))}
      </div>
    </SectionCard>
  )
}

// ============ Journal Entries ============
function JournalTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<{ accountCode: string; debit: string; credit: string }[]>([{ accountCode: '', debit: '', credit: '' }, { accountCode: '', debit: '', credit: '' }])

  const loadData = () => fetch('/api/erp/accounting/journal-entries').then(r => r.json()).then(d => setEntries(d.entries || []))
  useEffect(() => { loadData() }, [])

  async function openForm() {
    setShowForm(true)
    const res = await fetch('/api/erp/accounting/accounts')
    const d = await res.json()
    setAccounts(d.accounts || [])
  }

  function addLine() { setLines([...lines, { accountCode: '', debit: '', credit: '' }]) }
  function removeLine(i: number) { setLines(lines.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: string, value: string) { setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l)) }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  async function submit() {
    setLoading(true); setError('')
    try {
      if (!description) { setError('Description required'); setLoading(false); return }
      if (!isBalanced) { setError('Debits and credits must be equal'); setLoading(false); return }
      const res = await fetch('/api/erp/accounting/journal-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, lines: lines.filter(l => l.accountCode) }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setShowForm(false); setDescription(''); setLines([{ accountCode: '', debit: '', credit: '' }, { accountCode: '', debit: '', credit: '' }])
      loadData()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <SectionCard title="Journal Entries" subtitle={`${entries.length} entries`} action={<Button size="sm" onClick={openForm}><Plus className="h-4 w-4 mr-2" />New Entry</Button>}>
      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-border space-y-3">
          <div><Label className="text-xs">Description *</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Record monthly rent payment" /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Lines (debits must equal credits)</Label>
              <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <select className="w-full p-2 rounded border border-border text-sm" value={l.accountCode} onChange={e => updateLine(i, 'accountCode', e.target.value)}>
                      <option value="">Select account...</option>
                      {accounts.map(a => <option key={a.id} value={a.code}>{a.code} — {a.name} ({a.type})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2"><Input type="number" step="0.01" placeholder="Debit" value={l.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="text-right" /></div>
                  <div className="col-span-2"><Input type="number" step="0.01" placeholder="Credit" value={l.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="text-right" /></div>
                  <div className="col-span-2 flex items-center gap-1">
                    {lines.length > 2 && <Button size="sm" variant="ghost" className="text-rose-500 h-7 w-7 p-0" onClick={() => removeLine(i)}>×</Button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
              <span className="text-sm font-medium">Totals: Dr {formatCurrency(totalDebit)} / Cr {formatCurrency(totalCredit)}</span>
              <Badge className={isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>{isBalanced ? '✓ Balanced' : 'Not balanced'}</Badge>
            </div>
          </div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex gap-2"><Button size="sm" onClick={submit} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Post Entry</Button><Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">Entry #</th>
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Description</th>
            <th className="pb-2 pr-4 font-medium">Lines</th>
            <th className="pb-2 pr-4 font-medium">Source</th>
            <th className="pb-2 pr-4 font-medium text-right">Amount</th>
          </tr></thead>
          <tbody>
            {entries.map((e: any) => {
              const total = e.lines.reduce((s: number, l: any) => s + l.debit, 0)
              return (
                <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4 font-mono text-xs">{e.entryNumber}</td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">{formatDate(e.date)}</td>
                  <td className="py-2 pr-4">{e.description}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{e.lines.length}</td>
                  <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{e.refType || 'manual'}</Badge></td>
                  <td className="py-2 pr-4 text-right tabular-nums font-medium">{formatCurrency(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {entries.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No journal entries yet. Post one or record a payment/PO receipt to auto-generate entries.</div>}
      </div>
    </SectionCard>
  )
}

// ============ Trial Balance ============
function TrialBalanceTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/erp/accounting/trial-balance').then(r => r.json()).then(setData) }, [])

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <SectionCard title="Trial Balance" subtitle="All account balances — debits must equal credits">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/60">
            <th className="pb-2 pr-4 font-medium">Code</th>
            <th className="pb-2 pr-4 font-medium">Account</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium text-right">Debit</th>
            <th className="pb-2 pr-4 font-medium text-right">Credit</th>
          </tr></thead>
          <tbody>
            {data.rows?.map((r: any) => (
              <tr key={r.code} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-4 font-mono">{r.code}</td>
                <td className="py-2 pr-4">{r.name}</td>
                <td className="py-2 pr-4"><Badge className={TYPE_COLORS[r.type]}>{r.type}</Badge></td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td colSpan={3} className="py-3 pr-4">Total</td>
              <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(data.totalDebits)}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(data.totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-4">
        <Alert className={data.isBalanced ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}>
          {data.isBalanced ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
          <AlertDescription className={data.isBalanced ? 'text-emerald-800' : 'text-rose-800'}>
            {data.isBalanced ? `Trial balance is balanced ✓ (Dr = Cr = ${formatCurrency(data.totalDebits)})` : `Out of balance by ${formatCurrency(Math.abs(data.totalDebits - data.totalCredits))}`}
          </AlertDescription>
        </Alert>
      </div>
    </SectionCard>
  )
}

// ============ Profit & Loss ============
function ProfitLossTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/erp/accounting/profit-loss').then(r => r.json()).then(setData) }, [])

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <SectionCard title="Profit & Loss Statement" subtitle="Revenue minus expenses = Net Income">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue */}
        <div>
          <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" />Revenue</h4>
          <table className="w-full text-sm">
            <tbody>
              {data.revenue?.map((r: any) => (
                <tr key={r.code} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{r.code}</td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(r.balance)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-border">
                <td colSpan={2} className="py-3 pr-4">Total Revenue</td>
                <td className="py-3 text-right tabular-nums text-emerald-600">{formatCurrency(data.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Expenses */}
        <div>
          <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 rotate-180" />Expenses</h4>
          <table className="w-full text-sm">
            <tbody>
              {data.expenses?.map((e: any) => (
                <tr key={e.code} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{e.code}</td>
                  <td className="py-2 pr-4">{e.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(e.balance)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-border">
                <td colSpan={2} className="py-3 pr-4">Total Expenses</td>
                <td className="py-3 text-right tabular-nums text-amber-600">{formatCurrency(data.totalExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-muted/40">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">Net Income</span>
          <span className={`text-2xl font-bold tabular-nums ${data.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(data.netIncome)}</span>
        </div>
      </div>
    </SectionCard>
  )
}

// ============ Balance Sheet ============
function BalanceSheetTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/erp/accounting/balance-sheet').then(r => r.json()).then(setData) }, [])

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  return (
    <SectionCard title="Balance Sheet" subtitle="Assets = Liabilities + Equity">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets */}
        <div>
          <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2"><Scale className="h-4 w-4" />Assets</h4>
          <table className="w-full text-sm">
            <tbody>
              {data.assets?.map((a: any) => (
                <tr key={a.code} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{a.code}</td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(a.balance)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-border">
                <td colSpan={2} className="py-3 pr-4">Total Assets</td>
                <td className="py-3 text-right tabular-nums">{formatCurrency(data.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities + Equity */}
        <div>
          <h4 className="text-sm font-semibold text-rose-700 mb-3 flex items-center gap-2"><Scale className="h-4 w-4" />Liabilities & Equity</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr><td colSpan={3} className="py-1 text-xs font-semibold text-muted-foreground uppercase">Liabilities</td></tr>
              {data.liabilities?.map((l: any) => (
                <tr key={l.code} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{l.code}</td>
                  <td className="py-2 pr-4">{l.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(l.balance)}</td>
                </tr>
              ))}
              <tr><td colSpan={3} className="py-1 pt-3 text-xs font-semibold text-muted-foreground uppercase">Equity</td></tr>
              {data.equity?.map((e: any) => (
                <tr key={e.code} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{e.code}</td>
                  <td className="py-2 pr-4">{e.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(e.balance)}</td>
                </tr>
              ))}
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">—</td>
                <td className="py-2 pr-4 italic">Current Period Net Income</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(data.netIncome)}</td>
              </tr>
              <tr className="font-bold border-t-2 border-border">
                <td colSpan={2} className="py-3 pr-4">Total Liabilities + Equity</td>
                <td className="py-3 text-right tabular-nums">{formatCurrency(data.totalLiabilities + data.totalEquity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <Alert className={data.balanced ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}>
          {data.balanced ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
          <AlertDescription className={data.balanced ? 'text-emerald-800' : 'text-rose-800'}>
            {data.balanced ? `Balance sheet is balanced ✓ (Assets = L+E = ${formatCurrency(data.totalAssets)})` : `Out of balance: Assets ${formatCurrency(data.totalAssets)} vs L+E ${formatCurrency(data.totalLiabilities + data.totalEquity)}`}
          </AlertDescription>
        </Alert>
      </div>
    </SectionCard>
  )
}
