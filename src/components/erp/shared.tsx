'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
  hint?: string
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue'
  loading?: boolean
}

const ACCENTS = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-blue-50 text-blue-600',
}

const TREND_COLORS = {
  up: 'text-emerald-600',
  down: 'text-rose-600',
  neutral: 'text-slate-500',
}

export function KpiCard({ label, value, icon: Icon, trend, hint, accent = 'indigo', loading }: KpiCardProps) {
  return (
    <Card className="p-5 gap-0 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <div className={cn('rounded-xl p-2.5', ACCENTS[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={cn('text-xs font-semibold', TREND_COLORS[trend.direction])}>
            {trend.direction === 'up' && '↑'} {trend.direction === 'down' && '↓'} {trend.value}
          </span>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      )}
    </Card>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    received: 'bg-emerald-100 text-emerald-700',
    active: 'bg-emerald-100 text-emerald-700',
    lead: 'bg-amber-100 text-amber-700',
    inactive: 'bg-slate-100 text-slate-600',
    on_leave: 'bg-amber-100 text-amber-700',
    terminated: 'bg-rose-100 text-rose-700',
    income: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-rose-100 text-rose-700',
  }
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', colors[status.toLowerCase()] || 'bg-slate-100 text-slate-700')}>
      {label}
    </span>
  )
}

const LIFECYCLE_COLORS: Record<string, string> = {
  lead: 'bg-amber-100 text-amber-700 border-amber-200',
  mql: 'bg-blue-100 text-blue-700 border-blue-200',
  sql: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  opportunity: 'bg-purple-100 text-purple-700 border-purple-200',
  customer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  churned: 'bg-rose-100 text-rose-700 border-rose-200',
}

const LIFECYCLE_ORDER = ['lead', 'mql', 'sql', 'opportunity', 'customer', 'churned']

export function LifecycleBadge({ stage, showProgress = false }: { stage: string; showProgress?: boolean }) {
  const normalized = (stage || '').toLowerCase()
  const colorClass = LIFECYCLE_COLORS[normalized] || 'bg-slate-100 text-slate-700 border-slate-200'
  const label = normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const currentIdx = LIFECYCLE_ORDER.indexOf(normalized)

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border', colorClass)}>
        {label}
      </span>
      {showProgress && currentIdx >= 0 && currentIdx < 5 && (
        <span className="text-[10px] text-muted-foreground">
          Stage {currentIdx + 1} of 5
        </span>
      )}
    </span>
  )
}

export function SectionCard({ title, subtitle, action, children, className }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-0 overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            {title && <h3 className="font-semibold text-foreground">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
    </div>
  )
}
