import { db } from './db'

// Default currencies to seed per tenant
export const DEFAULT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', isBase: true },
  { code: 'EUR', name: 'Euro', symbol: '€', isBase: false },
  { code: 'GBP', name: 'British Pound', symbol: '£', isBase: false },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', isBase: false },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', isBase: false },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', isBase: false },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', isBase: false },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', isBase: false },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', isBase: false },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', isBase: false },
]

// Approximate exchange rates (in production, fetch from API like exchangerate-api.com)
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, MYR: 4.45, SGD: 1.34,
  CNY: 7.18, JPY: 149.5, AUD: 1.52, INR: 83.2, CAD: 1.36,
}

// Seed default currencies for a tenant
export async function seedCurrencies(tenantId: string) {
  const existing = await db.currency.count({ where: { tenantId } })
  if (existing > 0) return

  for (const c of DEFAULT_CURRENCIES) {
    const currency = await db.currency.create({
      data: { ...c, tenantId },
    })
    // Seed initial exchange rate
    await db.exchangeRate.create({
      data: {
        tenantId,
        currencyId: currency.id,
        rate: DEFAULT_RATES[c.code] || 1,
        date: new Date(),
      },
    })
  }
}

// Get all currencies for a tenant
export async function getCurrencies(tenantId: string) {
  await seedCurrencies(tenantId)
  return db.currency.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
  })
}

// Get the latest exchange rate for a currency
export async function getExchangeRate(tenantId: string, currencyCode: string): Promise<number> {
  if (currencyCode === 'USD') return 1 // base currency

  const currency = await db.currency.findUnique({ where: { tenantId_code: { tenantId, code: currencyCode } } })
  if (!currency) return 1

  const latestRate = await db.exchangeRate.findFirst({
    where: { tenantId, currencyId: currency.id },
    orderBy: { date: 'desc' },
  })

  return latestRate?.rate || DEFAULT_RATES[currencyCode] || 1
}

// Convert an amount from one currency to the base currency
export async function convertToBase(tenantId: string, amount: number, fromCurrency: string): Promise<number> {
  const rate = await getExchangeRate(tenantId, fromCurrency)
  return amount / rate // if 1 USD = 4.5 MYR, then 4.5 MYR / 4.5 = 1 USD
}

// Convert an amount from base currency to a target currency
export async function convertFromBase(tenantId: string, amount: number, toCurrency: string): Promise<number> {
  const rate = await getExchangeRate(tenantId, toCurrency)
  return amount * rate
}

// Format currency with symbol
export function formatCurrencyWithSymbol(amount: number, currencyCode: string, symbol?: string): string {
  const sym = symbol || DEFAULT_CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$'
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
