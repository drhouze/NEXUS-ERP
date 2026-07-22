import { db } from './db'

// Default chart of accounts (standard 5-tier structure)
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // Assets (1000-1999)
  { code: '1000', name: 'Cash', type: 'asset', subType: 'current_asset' },
  { code: '1010', name: 'Bank Account', type: 'asset', subType: 'current_asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subType: 'current_asset' },
  { code: '1200', name: 'Inventory', type: 'asset', subType: 'current_asset' },
  { code: '1500', name: 'Equipment', type: 'asset', subType: 'fixed_asset' },
  { code: '1510', name: 'Accumulated Depreciation', type: 'asset', subType: 'fixed_asset' },
  // Liabilities (2000-2999)
  { code: '2000', name: 'Accounts Payable', type: 'liability', subType: 'current_liability' },
  { code: '2100', name: 'Sales Tax Payable', type: 'liability', subType: 'current_liability' },
  { code: '2500', name: 'Long-term Loans', type: 'liability', subType: 'long_term_liability' },
  // Equity (3000-3999)
  { code: '3000', name: 'Owner Capital', type: 'equity', subType: 'equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subType: 'equity' },
  // Revenue (4000-4999)
  { code: '4000', name: 'Sales Revenue', type: 'revenue', subType: 'operating_revenue' },
  { code: '4100', name: 'Service Revenue', type: 'revenue', subType: 'operating_revenue' },
  { code: '4900', name: 'Sales Discounts', type: 'revenue', subType: 'contra_revenue' },
  // Expenses (5000-5999)
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', subType: 'cogs' },
  { code: '5100', name: 'Purchases', type: 'expense', subType: 'cogs' },
  { code: '6000', name: 'Salaries & Wages', type: 'expense', subType: 'operating_expense' },
  { code: '6100', name: 'Rent Expense', type: 'expense', subType: 'operating_expense' },
  { code: '6200', name: 'Utilities Expense', type: 'expense', subType: 'operating_expense' },
  { code: '6300', name: 'Marketing Expense', type: 'expense', subType: 'operating_expense' },
  { code: '6400', name: 'Office Supplies', type: 'expense', subType: 'operating_expense' },
  { code: '6500', name: 'Software & Subscriptions', type: 'expense', subType: 'operating_expense' },
  { code: '6600', name: 'Travel Expense', type: 'expense', subType: 'operating_expense' },
  { code: '6700', name: 'Depreciation Expense', type: 'expense', subType: 'operating_expense' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'expense', subType: 'operating_expense' },
]

// Seed default chart of accounts for a new tenant
export async function seedChartOfAccounts(tenantId: string) {
  const existing = await db.account.count({ where: { tenantId } })
  if (existing > 0) return // already seeded

  await db.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map(a => ({
      ...a,
      tenantId,
      isSystem: true,
    })),
  })
}

// Get an account by code for a tenant
export async function getAccount(tenantId: string, code: string) {
  return db.account.findUnique({ where: { tenantId_code: { tenantId, code } } })
}

// Post a journal entry (double-entry: debits must equal credits)
export async function postJournalEntry(params: {
  tenantId: string
  description: string
  refType?: string
  refId?: string
  lines: { accountCode: string; debit?: number; credit?: number; description?: string }[]
}): Promise<{ entryId: string; entryNumber: string }> {
  const { tenantId, description, refType, refId, lines } = params

  // Validate: total debits must equal total credits
  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0)

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal entry not balanced: debits=${totalDebits}, credits=${totalCredits}`)
  }
  if (lines.length < 2) {
    throw new Error('Journal entry must have at least 2 lines')
  }

  // Generate entry number
  const entryCount = await db.journalEntry.count({ where: { tenantId } })
  const entryNumber = `JE-${1001 + entryCount}`

  // Create the entry + lines + update account balances in a transaction
  const result = await db.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        description,
        refType: refType || null,
        refId: refId || null,
        status: 'posted',
      },
    })

    for (const line of lines) {
      const account = await tx.account.findUnique({ where: { tenantId_code: { tenantId, code: line.accountCode } } })
      if (!account) throw new Error(`Account ${line.accountCode} not found`)

      const debit = line.debit || 0
      const credit = line.credit || 0

      await tx.journalLine.create({
        data: {
          entryId: entry.id,
          accountId: account.id,
          debit,
          credit,
          description: line.description || null,
        },
      })

      // Update account balance
      // For assets & expenses: balance increases with debits
      // For liabilities, equity & revenue: balance increases with credits
      let balanceChange = 0
      if (account.type === 'asset' || account.type === 'expense') {
        balanceChange = debit - credit
      } else {
        balanceChange = credit - debit
      }

      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: balanceChange } },
      })
    }

    return entry
  })

  return { entryId: result.id, entryNumber: result.entryNumber }
}
