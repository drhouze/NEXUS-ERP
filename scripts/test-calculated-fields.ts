// Quick test for calculated-fields helpers
import {
  parseIcToBirthDate,
  parseIcToGender,
  computeAge,
  computeAgeFromIc,
  computeAgeFromDob,
  computeAgeFromIcOrDob,
  computeCalculatedValue,
} from '../src/lib/calculated-fields'

const cases: Array<{ name: string; fn: () => any; expected: any }> = [
  {
    name: 'parse IC 800101-14-5678 → 1980-01-01',
    fn: () => parseIcToBirthDate('800101-14-5678')?.toISOString().slice(0, 10),
    expected: '1980-01-01',
  },
  {
    name: 'parse IC 920515-08-1234 → 1992-05-15',
    fn: () => parseIcToBirthDate('920515-08-1234')?.toISOString().slice(0, 10),
    expected: '1992-05-15',
  },
  {
    name: 'parse IC 000707-10-1234 → 2000-07-07 (century cutoff)',
    fn: () => parseIcToBirthDate('000707-10-1234')?.toISOString().slice(0, 10),
    expected: '2000-07-07',
  },
  {
    name: 'parse IC no dashes 800101145678',
    fn: () => parseIcToBirthDate('800101145678')?.toISOString().slice(0, 10),
    expected: '1980-01-01',
  },
  {
    name: 'parse IC invalid (too short)',
    fn: () => parseIcToBirthDate('800101'),
    expected: null,
  },
  {
    name: 'parse IC invalid (bad month 13)',
    fn: () => parseIcToBirthDate('801301-14-5678'),
    expected: null,
  },
  {
    name: 'gender from IC ending odd (5678 → 8 even → Female)',
    fn: () => parseIcToGender('800101-14-5678'),
    expected: 'Female',
  },
  {
    name: 'gender from IC ending odd (5677 → 7 odd → Male)',
    fn: () => parseIcToGender('800101-14-5677'),
    expected: 'Male',
  },
  {
    name: 'compute age from DOB 1980-01-01',
    fn: () => computeAgeFromDob('1980-01-01'),
    expected: 46,
  },
  {
    name: 'compute age from IC 800101-14-5678',
    fn: () => computeAgeFromIc('800101-14-5678'),
    expected: 46,
  },
  {
    name: 'computeCalculatedValue age_from_ic',
    fn: () => computeCalculatedValue('age_from_ic', '800101-14-5678'),
    expected: '46',
  },
  {
    name: 'computeCalculatedValue age_from_dob',
    fn: () => computeCalculatedValue('age_from_dob', '1980-01-01'),
    expected: '46',
  },
  {
    name: 'computeCalculatedValue ic_gender (Male)',
    fn: () => computeCalculatedValue('ic_gender', '800101-14-5677'),
    expected: 'Male',
  },
  {
    name: 'computeCalculatedValue ic_dob',
    fn: () => computeCalculatedValue('ic_dob', '800101-14-5678'),
    expected: '1980-01-01',
  },
  {
    name: 'computeCalculatedValue empty source',
    fn: () => computeCalculatedValue('age_from_ic', ''),
    expected: '',
  },
  {
    name: 'computeCalculatedValue invalid IC',
    fn: () => computeCalculatedValue('age_from_ic', 'invalid'),
    expected: '',
  },
  // New tests for age_from_ic_or_dob (mixed local + foreign patients)
  {
    name: 'computeAgeFromIcOrDob with Malaysian IC',
    fn: () => computeAgeFromIcOrDob('800101-14-5678'),
    expected: 46,
  },
  {
    name: 'computeAgeFromIcOrDob with ISO date YYYY-MM-DD',
    fn: () => computeAgeFromIcOrDob('1980-01-01'),
    expected: 46,
  },
  {
    name: 'computeAgeFromIcOrDob with DD/MM/YYYY date',
    fn: () => computeAgeFromIcOrDob('01/01/1980'),
    expected: 46,
  },
  {
    name: 'computeAgeFromIcOrDob with DD-MM-YYYY date',
    fn: () => computeAgeFromIcOrDob('01-01-1980'),
    expected: 46,
  },
  {
    name: 'computeAgeFromIcOrDob with foreign passport number (not date, not IC) → null',
    fn: () => computeAgeFromIcOrDob('A12345678'),
    expected: null,
  },
  {
    name: 'computeAgeFromIcOrDob with empty string',
    fn: () => computeAgeFromIcOrDob(''),
    expected: null,
  },
  {
    name: 'computeCalculatedValue age_from_ic_or_dob (IC)',
    fn: () => computeCalculatedValue('age_from_ic_or_dob', '800101-14-5678'),
    expected: '46',
  },
  {
    name: 'computeCalculatedValue age_from_ic_or_dob (DOB ISO)',
    fn: () => computeCalculatedValue('age_from_ic_or_dob', '1980-01-01'),
    expected: '46',
  },
  {
    name: 'computeCalculatedValue age_from_ic_or_dob (foreign passport)',
    fn: () => computeCalculatedValue('age_from_ic_or_dob', 'A12345678'),
    expected: '',
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  let result
  try { result = c.fn() } catch (e: any) { result = `THREW: ${e.message}` }
  const ok = JSON.stringify(result) === JSON.stringify(c.expected)
  console.log(`${ok ? '✅' : '❌'} ${c.name}`)
  if (!ok) {
    console.log(`   expected: ${JSON.stringify(c.expected)}`)
    console.log(`   got:      ${JSON.stringify(result)}`)
    fail++
  } else {
    pass++
  }
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
