// ============ Shared ERP utility functions ============
// Currency, dates, numbers and status colours.
// The base currency symbol can be swapped at runtime (multi-tenant aware).

let _baseCurrencyCode = 'USD'
let _baseCurrencySymbol = '$'

/** Override the active base currency (called when a tenant's settings load). */
export function setBaseCurrency(code: string, symbol: string) {
  if (code) _baseCurrencyCode = code
  if (symbol) _baseCurrencySymbol = symbol
}

export function getBaseCurrencySymbol(): string {
  return _baseCurrencySymbol
}

export function getBaseCurrencyCode(): string {
  return _baseCurrencyCode
}

/**
 * Format a number as currency using the active base symbol.
 * Use `compact: true` for KPI tiles / large numbers.
 */
export function formatCurrency(
  n: number,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  const num = typeof n === 'number' && !Number.isNaN(n) ? n : 0
  if (opts.compact && Math.abs(num) >= 1000) {
    const compact = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num)
    return `${_baseCurrencySymbol}${compact}`
  }
  const decimals = opts.decimals ?? 0
  return `${_baseCurrencySymbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** Always 2 decimal places — for monetary amounts in tables / invoices. */
export function formatCurrencyDecimal(
  n: number,
  opts: { decimals?: number } = {},
): string {
  const num = typeof n === 'number' && !Number.isNaN(n) ? n : 0
  const decimals = opts.decimals ?? 2
  return `${_baseCurrencySymbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function formatNumber(n: number): string {
  const num = typeof n === 'number' && !Number.isNaN(n) ? n : 0
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', opts)
}

/** Compact relative-time string (e.g. "5m ago", "3d ago"). */
export function relativeTime(d: string | Date): string {
  if (!d) return ''
  const then = new Date(d).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 0) return 'just now'
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return formatDate(d)
}

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  received: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  lead: 'bg-amber-100 text-amber-700 border-amber-200',
  mql: 'bg-blue-100 text-blue-700 border-blue-200',
  sql: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  opportunity: 'bg-purple-100 text-purple-700 border-purple-200',
  customer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  churned: 'bg-rose-100 text-rose-700 border-rose-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
  terminated: 'bg-rose-100 text-rose-700 border-rose-200',
  income: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expense: 'bg-rose-100 text-rose-700 border-rose-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  unpaid: 'bg-rose-100 text-rose-700 border-rose-200',
}

export function statusBadgeClass(status: string): string {
  return STATUS_COLORS[status?.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200'
}
