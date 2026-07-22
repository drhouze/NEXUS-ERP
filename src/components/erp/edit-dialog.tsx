'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { CustomFieldsRenderer, saveCustomFieldValues } from './custom-fields-renderer'
import { NotesPanel } from './notes-panel'
import { AttachmentsPanel } from './attachments-panel'

export interface EditField {
  key: string
  label: string
  type:
    | 'text'
    | 'number'
    | 'email'
    | 'phone'
    | 'date'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'password'
  options?: string[]
  required?: boolean
  /** Conditional rendering — receives the current form data. */
  showIf?: (data: Record<string, any>) => boolean
  placeholder?: string
  /** Span both columns (defaults to true for textarea). */
  halfWidth?: boolean
}

export interface EditDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  fields: EditField[]
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => Promise<void> | void
  /** When set, custom fields are rendered + persisted on submit. */
  module?: string
  entityType?: string
  entityId?: string
  showNotes?: boolean
  showAttachments?: boolean
  submitLabel?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE_CLASS: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

/** Date objects / ISO strings → YYYY-MM-DD for HTML date inputs. */
function toDateInputValue(d: any): string {
  if (!d) return ''
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10)
  }
  if (d instanceof Date) return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  return ''
}

export function EditDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialData,
  onSubmit,
  module,
  entityType,
  entityId,
  showNotes,
  showAttachments,
  submitLabel = 'Save',
  size = 'md',
}: EditDialogProps) {
  const [data, setData] = React.useState<Record<string, any>>({})
  const [customValues, setCustomValues] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setData(initialData || {})
      setCustomValues({})
      setError('')
    }
  }, [open, initialData])

  // useCallback to avoid stale-closure pitfalls when passed to children.
  const setField = React.useCallback((key: string, value: any) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])

  const visibleFields = React.useMemo(
    () => fields.filter(f => !f.showIf || f.showIf(data)),
    [fields, data],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      for (const f of visibleFields) {
        if (
          f.required &&
          (data[f.key] === undefined || data[f.key] === null || data[f.key] === '')
        ) {
          throw new Error(`${f.label} is required`)
        }
      }
      await onSubmit(data)
      // Always persist custom field values on submit when configured.
      if (module && entityType && entityId) {
        await saveCustomFieldValues(module, entityId, customValues)
      }
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${SIZE_CLASS[size]} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleFields.map(f => {
              const isFull = f.type === 'textarea' || !f.halfWidth
              const val =
                f.type === 'date' ? toDateInputValue(data[f.key]) : data[f.key] ?? ''
              return (
                <div key={f.key} className={`space-y-1.5 ${isFull ? 'sm:col-span-2' : ''}`}>
                  <Label className="text-xs">
                    {f.label}
                    {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                  </Label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      value={val}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={val}
                      onChange={e => setField(f.key, e.target.value)}
                    >
                      <option value="">—</option>
                      {(f.options || []).map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={val === true || val === 'true'}
                        onCheckedChange={c => setField(f.key, !!c)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {val ? 'Yes' : 'No'}
                      </span>
                    </div>
                  ) : (
                    <Input
                      type={f.type}
                      value={val}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {module && entityType && (
            <div className="pt-3 border-t">
              <Label className="text-xs uppercase text-muted-foreground mb-2 block">
                Custom Fields
              </Label>
              <CustomFieldsRenderer
                module={module}
                entityType={entityType}
                entityId={entityId}
                values={customValues}
                onValuesChange={setCustomValues}
              />
            </div>
          )}

          {showNotes && entityType && entityId && (
            <div className="pt-3 border-t">
              <NotesPanel entityType={entityType} entityId={entityId} />
            </div>
          )}

          {showAttachments && entityType && entityId && (
            <div className="pt-3 border-t">
              <AttachmentsPanel entityType={entityType} entityId={entityId} />
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
