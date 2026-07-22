'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relativeTime } from './lib'

interface Notif {
  id: string
  type: string
  category: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}
const TYPE_COLOR: Record<string, string> = {
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-rose-500',
}

export function NotificationsBell() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const load = () => fetch('/api/erp/notifications').then(r => r.json()).then(d => {
    setNotifs(d.notifications || [])
    setUnread(d.unreadCount || 0)
  })
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  async function markAllRead() {
    await fetch('/api/erp/notifications', { method: 'POST' })
    load()
  }

  async function markOneRead(id: string) {
    await fetch(`/api/erp/notifications/${id}`, { method: 'PATCH' })
    load()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifs.map((n) => {
                const Icon = TYPE_ICON[n.type] || Info
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markOneRead(n.id)}
                    className={cn(
                      'w-full text-left p-3 hover:bg-muted/30 transition-colors block',
                      !n.read && 'bg-indigo-50/30'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', TYPE_COLOR[n.type] || 'text-blue-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{n.category}</Badge>
                          <span className="text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
