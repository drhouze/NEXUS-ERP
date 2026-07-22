// ============ Malaysian IC parser + calculated field engine ============
// IC format: YYMMDD-PB-####G (12 digits, dashes optional)
// Century cutoff: 00-30 → 2000s, 31-99 → 1900s

/**
 * Parse the birth date from a Malaysian IC number.
 * Returns null if the input is not a valid 12-digit IC.
 */
export function parseIcToBirthDate(ic: string): Date | null {
  if (!ic) return null
  const digits = ic.replace(/\D/g, '')
  if (digits.length !== 12) return null

  const yy = parseInt(digits.slice(0, 2), 10)
  const mm = parseInt(digits.slice(2, 4), 10)
  const dd = parseInt(digits.slice(4, 6), 10)
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null

  // Century cutoff: 00-30 → 2000s, 31-99 → 1900s
  const year = yy <= 30 ? 2000 + yy : 1900 + yy

  const d = new Date(year, mm - 1, dd)
  // Guard against rollover (e.g. Feb 30 → Mar 2)
  if (d.getFullYear() !== year || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return null
  }
  return d
}

/**
 * Parse gender from the last digit of a Malaysian IC.
 * Odd → Male, Even → Female. Returns null on invalid input.
 */
export function parseIcToGender(ic: string): 'Male' | 'Female' | null {
  if (!ic) return null
  const digits = ic.replace(/\D/g, '')
  if (digits.length !== 12) return null
  const last = parseInt(digits.slice(-1), 10)
  if (Number.isNaN(last)) return null
  return last % 2 === 0 ? 'Female' : 'Male'
}

/**
 * Compute age in whole years from a birth date (Date or ISO string).
 * Returns null when the input cannot be parsed.
 */
export function computeAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null
  const d = typeof birthDate === 'string' ? new Date(birthDate) : birthDate
  if (!(d instanceof Date) || isNaN(d.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age < 0 ? 0 : age
}

/** Age from IC number. */
export function computeAgeFromIc(ic: string | null | undefined): number | null {
  if (!ic) return null
  const bd = parseIcToBirthDate(ic)
  return bd ? computeAge(bd) : null
}

/** Age from DOB string (any value `new Date()` can parse). */
export function computeAgeFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  return computeAge(dob)
}

/**
 * Auto-detect the source: if it normalizes to 12 digits, treat it as an IC;
 * otherwise fall back to DOB parsing.
 */
export function computeAgeFromIcOrDob(value: string | null | undefined): number | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12) {
    const fromIc = computeAgeFromIc(value)
    if (fromIc !== null) return fromIc
  }
  return computeAgeFromDob(value)
}

/**
 * Dispatcher used by the custom-field renderer and forms to compute a
 * derived value at runtime. Supports:
 *   age_from_ic, age_from_dob, age_from_ic_or_dob, ic_gender, ic_dob, expression
 */
export function computeCalculatedValue(
  formulaType: string,
  sourceValue: string | null | undefined,
  formula?: string | null,
): string {
  if (!formulaType) return ''
  switch (formulaType) {
    case 'age_from_ic':
      return stringify(computeAgeFromIc(sourceValue))
    case 'age_from_dob':
      return stringify(computeAgeFromDob(sourceValue))
    case 'age_from_ic_or_dob':
      return stringify(computeAgeFromIcOrDob(sourceValue))
    case 'ic_gender':
      return parseIcToGender(sourceValue || '') ?? ''
    case 'ic_dob': {
      const bd = parseIcToBirthDate(sourceValue || '')
      return bd ? bd.toISOString().slice(0, 10) : ''
    }
    case 'expression': {
      // Safe-ish expression evaluator. {field} placeholders are replaced
      // with the source value (or 0 when missing). Only basic math is
      // allowed — anything else short-circuits to an empty string.
      try {
        if (!formula) return ''
        let expr = formula.replace(/\{[^}]+\}/g, () => {
          const n = parseFloat(sourceValue || '0')
          return Number.isFinite(n) ? String(n) : '0'
        })
        if (!/^[\d\s+\-*/.()]+$/.test(expr)) return ''
        const result = Function(`"use strict";return (${expr});`)()
        if (typeof result === 'number' && Number.isFinite(result)) {
          return String(Math.round(result * 100) / 100)
        }
        return ''
      } catch {
        return ''
      }
    }
    default:
      return ''
  }
}

function stringify(n: number | null): string {
  return n === null ? '' : String(n)
}
