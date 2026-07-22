'use client'

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Save,
  LayoutTemplate,
  Table as TableIcon,
  Section as SectionIcon,
} from 'lucide-react'

interface Section {
  id: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  label: string
  options?: string[]
  required?: boolean
  showOnInvoice?: boolean
  halfWidth?: boolean
}

interface ItemTableColumn {
  id: string
  type: 'text' | 'number' | 'select' | 'product'
  label: string
  options?: string[]
}

interface ItemTable {
  id: string
  name: string
  columns: ItemTableColumn[]
}

interface EncounterTemplateData {
  displayName: string
  sections: Section[]
  itemTables: ItemTable[]
  showAdvice: boolean
  adviceLabel: string
  showFollowUp: boolean
  followUpLabel: string
  showOnInvoice: boolean
  requireEncounterBeforeInvoice: boolean
  requiredSectionIds: string[]
  defaultDepositAmount: number | null
  defaultDepositLabel: string
}

interface Preset {
  label: string
  badge: string
  data: Partial<EncounterTemplateData>
}

const INDUSTRY_PRESETS: Record<string, Preset> = {
  medical: {
    label: 'Medical / Clinic',
    badge: 'Recommended for healthcare, dental, TCM clinics',
    data: {
      displayName: 'Clinical Encounter',
      sections: [
        { id: 'symptoms', type: 'textarea', label: 'Chief Complaints', required: true, showOnInvoice: true },
        { id: 'vitals', type: 'text', label: 'Vitals (BP/HR/Temp)', halfWidth: true },
        { id: 'diagnosis', type: 'textarea', label: 'Diagnosis', required: true, showOnInvoice: true },
        { id: 'plan', type: 'textarea', label: 'Treatment Plan', showOnInvoice: true },
      ],
      itemTables: [
        {
          id: 'rx',
          name: 'Prescription',
          columns: [
            { id: 'drug', type: 'product', label: 'Medication' },
            { id: 'dose', type: 'number', label: 'Dose (per intake)' },
            { id: 'freq', type: 'select', label: 'Frequency', options: ['OD (once daily)', 'BD (twice daily)', 'TDS (3x daily)', 'QDS (4x daily)', 'PRN (as needed)'] },
            { id: 'duration', type: 'number', label: 'Duration (days)' },
            { id: 'qty', type: 'number', label: 'Total Qty (auto)' },
            { id: 'instructions', type: 'text', label: 'Instructions' },
          ],
        },
      ],
      showAdvice: true,
      adviceLabel: 'Advice / Patient Education',
      showFollowUp: true,
      followUpLabel: 'Follow-up',
    },
  },
  hotel: {
    label: 'Hotel / Hospitality',
    badge: 'Recommended for hotels, spas, salons',
    data: {
      displayName: 'Guest Service Form',
      sections: [
        { id: 'room', type: 'text', label: 'Room #', halfWidth: true, required: true },
        {
          id: 'service',
          type: 'select',
          label: 'Service Type',
          options: ['Room Service', 'Spa', 'Laundry', 'Concierge'],
          halfWidth: true,
        },
        { id: 'requests', type: 'textarea', label: 'Special Requests' },
      ],
      itemTables: [
        {
          id: 'charges',
          name: 'Additional Charges',
          columns: [
            { id: 'item', type: 'product', label: 'Item' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: false,
      showFollowUp: false,
    },
  },
  tailor: {
    label: 'Tailor / Fashion',
    badge: 'Recommended for tailors, boutiques',
    data: {
      displayName: 'Measurement & Order Form',
      sections: [
        {
          id: 'garment',
          type: 'select',
          label: 'Garment Type',
          options: ['Shirt', 'Suit', 'Dress', 'Trousers', 'Kurung'],
          required: true,
          halfWidth: true,
        },
        { id: 'fabric', type: 'text', label: 'Fabric', halfWidth: true },
        { id: 'measurements', type: 'textarea', label: 'Measurements', required: true, showOnInvoice: true },
        { id: 'notes', type: 'textarea', label: 'Style Notes' },
      ],
      itemTables: [
        {
          id: 'items',
          name: 'Line Items',
          columns: [
            { id: 'item', type: 'product', label: 'Item' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: true,
      adviceLabel: 'Care Instructions',
      showFollowUp: true,
      followUpLabel: 'Fitting Appointment',
    },
  },
  trading: {
    label: 'Trading / Retail',
    badge: 'Recommended for retail, wholesale, F&B',
    data: {
      displayName: 'Order Form',
      sections: [{ id: 'notes', type: 'textarea', label: 'Order Notes' }],
      itemTables: [
        {
          id: 'items',
          name: 'Items',
          columns: [
            { id: 'item', type: 'product', label: 'Product' },
            { id: 'qty', type: 'number', label: 'Qty' },
          ],
        },
      ],
      showAdvice: false,
      showFollowUp: false,
    },
  },
  blank: {
    label: 'Blank (Start from scratch)',
    badge: 'Build your own form',
    data: { displayName: 'Service Form', sections: [], itemTables: [] },
  },
}

const DEFAULT_TEMPLATE: EncounterTemplateData = {
  displayName: 'Service Form',
  sections: [],
  itemTables: [],
  showAdvice: true,
  adviceLabel: 'Advice / Notes',
  showFollowUp: true,
  followUpLabel: 'Follow-up',
  showOnInvoice: true,
  requireEncounterBeforeInvoice: false,
  requiredSectionIds: [],
  defaultDepositAmount: null,
  defaultDepositLabel: 'Deposit',
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export interface EncounterFormDesignerProps {
  tenantId?: string
  industry?: string
}

export function EncounterFormDesigner({ industry }: EncounterFormDesignerProps = {}) {
  const [template, setTemplate] = React.useState<EncounterTemplateData>(DEFAULT_TEMPLATE)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [savedMsg, setSavedMsg] = React.useState('')

  // Recommend a preset based on the tenant industry string.
  const recommendedKey = React.useMemo(() => {
    if (!industry) return null
    const k = industry.toLowerCase()
    if (/(med|clinic|dental|health|hospital)/.test(k)) return 'medical'
    if (/(hotel|hospitality|spa|salon|resort)/.test(k)) return 'hotel'
    if (/(tailor|fashion|boutique|garment)/.test(k)) return 'tailor'
    if (/(trad|retail|wholesale|f&b|food|trading)/.test(k)) return 'trading'
    return null
  }, [industry])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/erp/encounter-template')
      if (res.ok) {
        const d = await res.json()
        const t = d.template || d
        if (t) {
          setTemplate({
            ...DEFAULT_TEMPLATE,
            ...t,
            sections: parseArr<Section>(t.sections),
            itemTables: parseArr<ItemTable>(t.itemTables),
            requiredSectionIds: parseArr<string>(t.requiredSectionIds),
          })
        }
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  function applyPreset(key: string) {
    const preset = INDUSTRY_PRESETS[key]
    if (!preset) return
    setTemplate({
      ...DEFAULT_TEMPLATE,
      ...preset.data,
      sections: (preset.data.sections || []).map((s: any) => ({ ...s, id: s.id || uid() })),
      itemTables: (preset.data.itemTables || []).map((t: any) => ({
        ...t,
        id: t.id || uid(),
        columns: (t.columns || []).map((c: any) => ({ ...c, id: c.id || uid() })),
      })),
      requiredSectionIds: [],
    } as EncounterTemplateData)
  }

  async function save() {
    setSaving(true)
    setSavedMsg('')
    try {
      const res = await fetch('/api/erp/encounter-template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      })
      setSavedMsg(res.ok ? 'Saved' : 'Failed to save')
    } catch {
      setSavedMsg('Failed to save')
    } finally {
      setSaving(false)
    }
    setTimeout(() => setSavedMsg(''), 2000)
  }

  // ---- Section ops ----
  function addSection() {
    setTemplate(t => ({
      ...t,
      sections: [
        ...t.sections,
        { id: uid(), type: 'text', label: 'New Field', required: false, showOnInvoice: false, halfWidth: false },
      ],
    }))
  }
  function updateSection(id: string, patch: Partial<Section>) {
    setTemplate(t => ({ ...t, sections: t.sections.map(s => (s.id === id ? { ...s, ...patch } : s)) }))
  }
  function removeSection(id: string) {
    setTemplate(t => ({
      ...t,
      sections: t.sections.filter(s => s.id !== id),
      requiredSectionIds: t.requiredSectionIds.filter(x => x !== id),
    }))
  }
  function moveSection(idx: number, dir: -1 | 1) {
    setTemplate(t => {
      const arr = [...t.sections]
      const ni = idx + dir
      if (ni < 0 || ni >= arr.length) return t
      ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
      return { ...t, sections: arr }
    })
  }

  // ---- Item-table ops ----
  function addTable() {
    setTemplate(t => ({
      ...t,
      itemTables: [...t.itemTables, { id: uid(), name: 'New Table', columns: [] }],
    }))
  }
  function updateTable(id: string, patch: Partial<ItemTable>) {
    setTemplate(t => ({
      ...t,
      itemTables: t.itemTables.map(tb => (tb.id === id ? { ...tb, ...patch } : tb)),
    }))
  }
  function removeTable(id: string) {
    setTemplate(t => ({ ...t, itemTables: t.itemTables.filter(tb => tb.id !== id) }))
  }
  function addColumn(tableId: string) {
    setTemplate(t => ({
      ...t,
      itemTables: t.itemTables.map(tb =>
        tb.id === tableId
          ? { ...tb, columns: [...tb.columns, { id: uid(), type: 'text', label: 'New Column' }] }
          : tb,
      ),
    }))
  }
  function updateColumn(tableId: string, colId: string, patch: Partial<ItemTableColumn>) {
    setTemplate(t => ({
      ...t,
      itemTables: t.itemTables.map(tb =>
        tb.id === tableId
          ? { ...tb, columns: tb.columns.map(c => (c.id === colId ? { ...c, ...patch } : c)) }
          : tb,
      ),
    }))
  }
  function removeColumn(tableId: string, colId: string) {
    setTemplate(t => ({
      ...t,
      itemTables: t.itemTables.map(tb =>
        tb.id === tableId ? { ...tb, columns: tb.columns.filter(c => c.id !== colId) } : tb,
      ),
    }))
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading template…</div>
  }

  return (
    <div className="space-y-6">
      {/* Industry presets */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <LayoutTemplate className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Industry Presets</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(INDUSTRY_PRESETS).map(([key, p]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(key)}
            >
              {p.label}
              {recommendedKey === key && (
                <Badge variant="secondary" className="ml-2 text-[10px]">Recommended</Badge>
              )}
            </Button>
          ))}
        </div>
        {recommendedKey && (
          <p className="text-xs text-muted-foreground mt-2">
            <span className="font-medium">{INDUSTRY_PRESETS[recommendedKey].label}</span> —{' '}
            {INDUSTRY_PRESETS[recommendedKey].badge}
          </p>
        )}
      </Card>

      {/* General */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">General</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Form Name</Label>
            <Input
              value={template.displayName}
              onChange={e => setTemplate(t => ({ ...t, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default Deposit Amount (optional)</Label>
            <Input
              type="number"
              value={template.defaultDepositAmount ?? ''}
              onChange={e =>
                setTemplate(t => ({
                  ...t,
                  defaultDepositAmount: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Deposit Label</Label>
            <Input
              value={template.defaultDepositLabel}
              onChange={e => setTemplate(t => ({ ...t, defaultDepositLabel: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {/* Sections */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionIcon className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Form Fields ({template.sections.length})</h3>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addSection}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Field
          </Button>
        </div>
        {template.sections.length === 0 && (
          <p className="text-xs text-muted-foreground">No fields. Add one or apply a preset.</p>
        )}
        {template.sections.map((s, idx) => (
          <div key={s.id} className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={s.label}
                onChange={e => updateSection(s.id, { label: e.target.value })}
                placeholder="Field label"
              />
              {/* Native <select> — avoids Radix-Select spacebar focus quirks */}
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={s.type}
                onChange={e => updateSection(s.id, { type: e.target.value as Section['type'] })}
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveSection(idx, -1)}
                disabled={idx === 0}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveSection(idx, 1)}
                disabled={idx === template.sections.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-rose-600"
                onClick={() => removeSection(s.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {s.type === 'select' && (
              <Input
                value={(s.options || []).join(', ')}
                onChange={e =>
                  updateSection(s.id, {
                    options: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
                  })
                }
                placeholder="Comma-separated options"
              />
            )}
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={!!s.required}
                  onCheckedChange={c => updateSection(s.id, { required: !!c })}
                />
                Required
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={!!s.showOnInvoice}
                  onCheckedChange={c => updateSection(s.id, { showOnInvoice: !!c })}
                />
                Show on invoice
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={!!s.halfWidth}
                  onCheckedChange={c => updateSection(s.id, { halfWidth: !!c })}
                />
                Half width
              </label>
            </div>
          </div>
        ))}
      </Card>

      {/* Item tables */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Item Tables ({template.itemTables.length})</h3>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addTable}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Table
          </Button>
        </div>
        {template.itemTables.map(tb => (
          <div key={tb.id} className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={tb.name}
                onChange={e => updateTable(tb.id, { name: e.target.value })}
                placeholder="Table name (e.g. Prescription)"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-rose-600"
                onClick={() => removeTable(tb.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2 pl-3 border-l-2 border-border">
              {tb.columns.map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={c.label}
                    onChange={e => updateColumn(tb.id, c.id, { label: e.target.value })}
                    placeholder="Column label"
                  />
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={c.type}
                    onChange={e => updateColumn(tb.id, c.id, { type: e.target.value as ItemTableColumn['type'] })}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="product">Product Lookup</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-rose-600"
                    onClick={() => removeColumn(tb.id, c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => addColumn(tb.id)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Column
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Common blocks */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Common Blocks</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={template.showAdvice}
              onCheckedChange={c => setTemplate(t => ({ ...t, showAdvice: !!c }))}
            />
            <span className="text-sm">Advice / Notes block</span>
          </label>
          {template.showAdvice && (
            <Input
              value={template.adviceLabel}
              onChange={e => setTemplate(t => ({ ...t, adviceLabel: e.target.value }))}
              placeholder="Advice label"
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={template.showFollowUp}
              onCheckedChange={c => setTemplate(t => ({ ...t, showFollowUp: !!c }))}
            />
            <span className="text-sm">Follow-up block</span>
          </label>
          {template.showFollowUp && (
            <Input
              value={template.followUpLabel}
              onChange={e => setTemplate(t => ({ ...t, followUpLabel: e.target.value }))}
              placeholder="Follow-up label"
            />
          )}
        </div>
      </Card>

      {/* Workflow gate */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Workflow Gate</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={template.requireEncounterBeforeInvoice}
            onCheckedChange={c => setTemplate(t => ({ ...t, requireEncounterBeforeInvoice: !!c }))}
          />
          <span className="text-sm">Require encounter before invoicing</span>
        </label>
        <div className="space-y-1.5">
          <Label className="text-xs">Required Section IDs (must be filled before invoice)</Label>
          <div className="flex flex-wrap gap-2">
            {template.sections.map(s => (
              <label key={s.id} className="flex items-center gap-1.5 cursor-pointer text-xs">
                <Checkbox
                  checked={template.requiredSectionIds.includes(s.id)}
                  onCheckedChange={c =>
                    setTemplate(t => ({
                      ...t,
                      requiredSectionIds: c
                        ? [...t.requiredSectionIds, s.id]
                        : t.requiredSectionIds.filter(x => x !== s.id),
                    }))
                  }
                />
                {s.label}
              </label>
            ))}
            {template.sections.length === 0 && (
              <span className="text-xs text-muted-foreground">No sections yet.</span>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Template
        </Button>
        {savedMsg && <span className="text-sm text-muted-foreground">{savedMsg}</span>}
      </div>
    </div>
  )
}
