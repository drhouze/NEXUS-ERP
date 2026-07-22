'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Paperclip, Download, Trash2, FileText, Upload } from 'lucide-react'
import { relativeTime } from './lib'

export interface AttachmentsPanelProps {
  entityType: string
  entityId: string
  className?: string
}

function fmtSize(b: number): string {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * File upload / download / delete panel. Files are POSTed as base64
 * (so the backend can store them anywhere) and re-downloaded on demand.
 */
export function AttachmentsPanel({ entityType, entityId, className }: AttachmentsPanelProps) {
  const [attachments, setAttachments] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/erp/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      )
      if (res.ok) {
        const d = await res.json()
        setAttachments(d.attachments || d || [])
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = reject
          r.readAsDataURL(file)
        })
        await fetch('/api/erp/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType,
            entityId,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            data: dataUrl.split(',')[1], // strip the `data:…;base64,` prefix
          }),
        })
      }
      await load()
    } catch {
      /* swallow */
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(a: any) {
    try {
      const res = await fetch(`/api/erp/attachments/${a.id}`)
      if (!res.ok) return
      const d = await res.json()
      const data = d.data || d.attachment?.data
      if (!data) return
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: a.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = a.fileName || 'attachment'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      /* swallow */
    }
  }

  async function handleDelete(a: any) {
    if (!confirm(`Delete ${a.fileName}?`)) return
    try {
      await fetch(`/api/erp/attachments/${a.id}`, { method: 'DELETE' })
      await load()
    } catch {
      /* swallow */
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase text-muted-foreground">Attachments</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments.</p>
        ) : (
          attachments.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{a.fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtSize(a.size)} · {relativeTime(a.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(a)}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-rose-600"
                onClick={() => handleDelete(a)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
