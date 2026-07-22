'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { SectionCard } from './shared'
import { formatCurrency, formatNumber } from './lib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ShoppingCart, Truck, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'

const TYPE_META: Record<string, { icon: any, color: string, label: string }> = {
  order: { icon: ShoppingCart, color: 'bg-indigo-100 text-indigo-700', label: 'Order' },
  po: { icon: Truck, color: 'bg-blue-100 text-blue-700', label: 'PO' },
  income: { icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700', label: 'Income' },
  expense: { icon: TrendingDown, color: 'bg-rose-100 text-rose-700', label: 'Expense' },
}

export function CalendarModule() {
  const [data, setData] = useState<any>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7))

  const loadData = () => fetch(`/api/erp/calendar?month=${currentMonth}`).then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [currentMonth])

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCurrentMonth(d.toISOString().slice(0, 7))
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(d.toISOString().slice(0, 7))
  }

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />

  // Build calendar grid
  const [year, month] = currentMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay() // 0 = Sunday

  // Group events by date
  const eventsByDate: Record<string, any[]> = {}
  for (const e of data.events) {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = []
    eventsByDate[e.date].push(e)
  }

  const today = new Date().toISOString().slice(0, 10)
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-0 overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700 text-white border-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1"><CalendarIcon className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider opacity-90">Schedule</span></div>
            <h2 className="text-2xl font-bold">Calendar & Timeline</h2>
            <p className="text-sm opacity-90 mt-1">All orders, POs, and transactions in a calendar view</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4"><ShoppingCart className="h-4 w-4 text-indigo-500 mb-1" /><p className="text-xs text-muted-foreground">Orders</p><p className="text-xl font-bold">{data.stats.orders}</p></Card>
        <Card className="p-4"><Truck className="h-4 w-4 text-blue-500 mb-1" /><p className="text-xs text-muted-foreground">POs</p><p className="text-xl font-bold">{data.stats.pos}</p></Card>
        <Card className="p-4"><TrendingUp className="h-4 w-4 text-emerald-500 mb-1" /><p className="text-xs text-muted-foreground">Income</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(data.stats.revenue, { compact: true })}</p></Card>
        <Card className="p-4"><TrendingDown className="h-4 w-4 text-rose-500 mb-1" /><p className="text-xs text-muted-foreground">Expenses</p><p className="text-xl font-bold text-rose-600">{formatCurrency(data.stats.expenses, { compact: true })}</p></Card>
        <Card className="p-4"><CalendarIcon className="h-4 w-4 text-purple-500 mb-1" /><p className="text-xs text-muted-foreground">Net</p><p className={`text-xl font-bold ${data.stats.revenue - data.stats.expenses >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(data.stats.revenue - data.stats.expenses, { compact: true })}</p></Card>
      </div>

      {/* Calendar */}
      <SectionCard title={monthName} subtitle={`${data.events.length} events this month`} action={
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCurrentMonth(new Date().toISOString().slice(0, 7))}>Today</Button>
          <Button size="sm" variant="outline" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      }>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] rounded-lg bg-muted/20" />
          ))}
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`
            const dayEvents = eventsByDate[dateStr] || []
            const isToday = dateStr === today

            return (
              <div key={day} className={`min-h-[80px] rounded-lg border p-1.5 ${isToday ? 'border-indigo-400 bg-indigo-50/30' : 'border-border/60'}`}>
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-indigo-600' : 'text-muted-foreground'}`}>{day}</div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e, idx) => {
                    const meta = TYPE_META[e.type] || TYPE_META.order
                    const Icon = meta.icon
                    return (
                      <div key={idx} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${meta.color} truncate`} title={e.title}>
                        <Icon className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{e.title}</span>
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Event list */}
      <SectionCard title="All Events" subtitle={`${data.events.length} events`}>
        <div className="overflow-x-auto -mx-5 px-5 max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Description</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e, i) => {
                const meta = TYPE_META[e.type] || TYPE_META.order
                const Icon = meta.icon
                return (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{e.date}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{e.time}</td>
                    <td className="py-2 pr-4"><Badge className={meta.color}><Icon className="h-2.5 w-2.5 mr-1" />{meta.label}</Badge></td>
                    <td className="py-2 pr-4 font-medium">{e.title}</td>
                    <td className="py-2 pr-4">{e.status && <Badge variant="outline" className="text-xs capitalize">{e.status}</Badge>}</td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{e.amount ? formatCurrency(e.amount) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.events.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No events this month</div>}
        </div>
      </SectionCard>
    </div>
  )
}
