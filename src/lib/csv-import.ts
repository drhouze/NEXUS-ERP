/**
 * CSV parser + conservative type coercion — the reverse of csv-export.ts.
 */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

export function parseCsvRows(csv: string): string[][] {
  const text = stripBom(csv.replace(/^\ufeff/, ''))
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false }
      } else { cell += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\r') {
        row.push(cell); rows.push(row); row = []; cell = ''
        if (text[i + 1] === '\n') i++
      } else if (ch === '\n') {
        row.push(cell); rows.push(row); row = []; cell = ''
      } else { cell += ch }
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  while (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') rows.pop(); else break
  }
  return rows
}

function coerceValue(v: string): any {
  if (v === '') return null
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+$/.test(v)) {
    if (v === '0' || v === '-0') return 0
    if (v.startsWith('-')) { if (!/^0\d/.test(v.slice(1))) return parseInt(v, 10) }
    else if (!/^0\d/.test(v)) return parseInt(v, 10)
    return v
  }
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v)
  return v
}

export function parseCsv(csv: string): any[] {
  const rows = parseCsvRows(csv)
  if (rows.length < 2) return []
  const headers = rows[0]
  const records: any[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rec: any = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (!key) continue
      rec[key] = coerceValue(c < row.length ? row[c] : '')
    }
    records.push(rec)
  }
  return records
}
