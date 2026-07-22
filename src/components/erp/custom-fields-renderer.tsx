'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeCalculatedValue } from '@/lib/calculated-fields'

export interface CustomFieldDef {
  id: string
  fieldKey: string
  label: string
  type: string // text | number | email | phone | url | date | textarea | select | checkbox | formula | calculated
  options?: string | null
  defaultValue?: string | null
  formula?: string | null
  formulaType?: string | null
  sourceField?: string | null
  isRequired?: boolean
  sortOrder?: number
}

export interface CustomFieldsRendererProps {
  /** Module name for field definitions (e.g. "customer", "product"). */
  module: string
  /** Entity type for value lookup (e.g. "customer"). */
  entityType: string
  /** Entity ID — when provided, existing values are fetched once. */
  entityId?: string
  /** Controlled values map. When omitted, internal state is used. */
  values?: Record<string, string>
  onValuesChange?: (values: Record<string, string>) => void
  /** Bulk-load hook for parent components that want to capture existing values. */
  onBatchLoad?: (values: Record<string, string>) => void
  /** Skip the field-definitions fetch by passing them directly. */
  fields?: CustomFieldDef[]
  className?: string
  compact?: boolean
}

/**
 * Save custom field values for an entity.
 * Exported so callers (e.g. EditDialog, forms) can persist values on submit.
 */
export async function saveCustomFieldValues(
  module: string,
  entityId: string,
  values: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch('/api/erp/custom-fields/values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, entityId, values }),
    })
    return res.ok
  } catch {
    return false
  }
}

function parseOptions(opts?: string | null): string[] {
  if (!opts) return []
  try {
    const parsed = JSON.parse(opts)
    if (Array.isArray(parsed)) return parsed.map(String)
    if (typeof parsed === 'string') return parsed.split(',').map(s => s.trim()).filter(Boolean)
  } catch {
    /* fall through */
  }
  return String(opts).split(',').map(s => s.trim()).filter(Boolean)
}

export function CustomFieldsRenderer({
  module,
  entityType,
  entityId,
  values: controlledValues,
  onValuesChange,
  onBatchLoad,
  fields: providedFields,
  className,
  compact,
}: CustomFieldsRendererProps) {
  const [fields, setFields] = React.useState<CustomFieldDef[]>(providedFields || [])
  const [internalValues, setInternalValues] = React.useState<Record<string, string>>({})
  const values = controlledValues ?? internalValues

  // Guards to prevent duplicate fetches across re-renders.
  const fetchedFieldsRef = React.useRef(false)
  const fetchedValuesRef = React.useRef<string | null>(null)

  // ---- Load field definitions (only once per mount) ----
  React.useEffect(() => {
    if (providedFields) {
      setFields(providedFields)
      return
    }
    if (fetchedFieldsRef.current) return
    fetchedFieldsRef.current = true
    fetch(`/api/erp/custom-fields/values?module=${encodeURIComponent(module)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const list = d?.fields || (Array.isArray(d) ? d : null)
        if (Array.isArray(list)) setFields(list)
      })
      .catch(() => {})
  }, [module, providedFields])

  // ---- Load existing values (guarded per entityId so we don't refetch) ----
  React.useEffect(() => {
    if (!entityId) return
    const key = `${entityType}:${entityId}`
    if (fetchedValuesRef.current === key) return
    fetchedValuesRef.current = key
    fetch(
      `/api/erp/custom-fields/values?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    )
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const map: Record<string, string> = {}
        const list = d?.values || (Array.isArray(d) ? d : null)
        if (Array.isArray(list)) {
          for (const v of list) {
            if (v.fieldKey) map[v.fieldKey] = v.value
            else if (v.customField?.fieldKey) map[v.customField.fieldKey] = v.value
          }
        } else if (d && typeof d === 'object') {
          for (const [k, v] of Object.entries(d)) {
            if (typeof v === 'string' || typeof v === 'number') map[k] = String(v)
          }
        }
        if (onBatchLoad) onBatchLoad(map)
        else setInternalValues(prev => ({ ...map, ...prev }))
      })
      .catch(() => {})
  }, [entityType, entityId, onBatchLoad])

  // ---- Auto-compute calculated fields ----
  const computedValues = React.useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of fields) {
      if (f.type === 'calculated' && f.formulaType) {
        const src = f.sourceField ? values[f.sourceField] ?? '' : ''
        out[f.fieldKey] = computeCalculatedValue(f.formulaType, src, f.formula)
      }
    }
    return out
  }, [fields, values])

  function setValue(key: string, val: string) {
    const next = { ...values, [key]: val }
    if (onValuesChange) onValuesChange(next)
    else setInternalValues(next)
  }

  if (fields.length === 0) return null

  const sorted = fields.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', compact && 'sm:grid-cols-1', className)}>
      {sorted.map(f => {
        const val = values[f.fieldKey] ?? f.defaultValue ?? ''
        const computed = computedValues[f.fieldKey]
        const isCalculated = f.type === 'calculated'
        const isFormula = f.type === 'formula'
        const isFullRow = f.type === 'textarea'
        return (
          <div key={f.id} className={cn('space-y-1.5', isFullRow && 'sm:col-span-2')}>
            <Label className="text-xs flex items-center gap-1.5">
              {(isCalculated || isFormula) && <Calculator className="h-3 w-3 text-teal-600" />}
              {f.label}
              {f.isRequired && <span className="text-rose-500">*</span>}
            </Label>
            {isCalculated ? (
              <Input
                readOnly
                value={computed || val || ''}
                placeholder="Auto-calculated"
                className="bg-teal-50 border-teal-200 text-teal-900 font-medium"
              />
            ) : f.type === 'textarea' ? (
              <Textarea value={val} onChange={e => setValue(f.fieldKey, e.target.value)} rows={3} />
            ) : f.type === 'number' ? (
              <Input type="number" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            ) : f.type === 'email' ? (
              <Input type="email" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            ) : f.type === 'phone' ? (
              <Input type="tel" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            ) : f.type === 'url' ? (
              <Input type="url" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            ) : f.type === 'date' ? (
              <Input type="date" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            ) : f.type === 'select' ? (
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={val}
                onChange={e => setValue(f.fieldKey, e.target.value)}
              >
                <option value="">—</option>
                {parseOptions(f.options).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'checkbox' ? (
              <div className="flex items-center gap-2 h-9">
                <Checkbox
                  checked={val === 'true' || val === '1'}
                  onCheckedChange={c => setValue(f.fieldKey, c ? 'true' : 'false')}
                />
                <span className="text-sm text-muted-foreground">
                  {val === 'true' || val === '1' ? 'Yes' : 'No'}
                </span>
              </div>
            ) : f.type === 'formula' ? (
              <Input
                readOnly
                value={val || computed || ''}
                placeholder="Formula"
                className="bg-teal-50 border-teal-200 text-teal-900 font-medium"
              />
            ) : (
              <Input type="text" value={val} onChange={e => setValue(f.fieldKey, e.target.value)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
