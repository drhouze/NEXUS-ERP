'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { relativeTime } from './lib'

export interface NotesPanelProps {
  entityType: string
  entityId: string
  className?: string
}

/**
 * Notes / comments panel. Loads existing notes for an entity and lets the
 * user append new ones. The author name and relative time are shown for
 * each entry.
 */
export function NotesPanel({ entityType, entityId, className }: NotesPanelProps) {
  const [notes, setNotes] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [text, setText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/erp/notes?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      )
      if (res.ok) {
        const d = await res.json()
        setNotes(d.notes || d || [])
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

  async function submit() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/erp/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, content: text }),
      })
      if (res.ok) {
        setText('')
        await load()
      }
    } catch {
      /* swallow */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase text-muted-foreground">Notes & Comments</span>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto mb-3 pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          notes.map(n => (
            <div key={n.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {(n.author?.name || n.authorName || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {n.author?.name || n.authorName || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{n.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…  (⌘/Ctrl + Enter to send)"
          rows={2}
          className="text-sm"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <Button type="button" size="sm" onClick={submit} disabled={submitting || !text.trim()}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
