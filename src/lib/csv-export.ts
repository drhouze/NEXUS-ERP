/**
 * Tiny CSV helper — no external dependency.
 */
export function escapeCsvCell(v: any): string {
  if (v === undefined || v === null) return ''
  let s: string
  if (v instanceof Date) {
    s = v.toISOString()
  } else if (typeof v === 'object') {
    s = JSON.stringify(v)
  } else {
    s = String(v)
  }
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function recordsToCsv(rows: any[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const seen = new Set<string>()
  const columns: string[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); columns.push(k) }
    }
  }
  const lines: string[] = []
  lines.push(columns.map(escapeCsvCell).join(','))
  for (const row of rows) {
    lines.push(columns.map(c => escapeCsvCell(row?.[c])).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

export function withBom(csv: string): string {
  return '\ufeff' + csv
}
