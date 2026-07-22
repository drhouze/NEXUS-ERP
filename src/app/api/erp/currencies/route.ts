import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { seedCurrencies } from '@/lib/currency'
import { logAction } from '@/lib/audit'

// GET /api/erp/currencies - list currencies + exchange rates
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'OWNER') return NextResponse.json({ isOwner: true })

  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  await seedCurrencies(tenantId)

  const currencies = await db.currency.findMany({
    where: { tenantId },
    orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    include: {
      exchangeRates: { orderBy: { date: 'desc' }, take: 1 },
    },
  })

  return NextResponse.json({ currencies })
}

// PATCH - set base currency or update exchange rate
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const body = await req.json()
    const { action, currencyId, rate, newBaseCode } = body

    if (action === 'set_base') {
      // Unset all base currencies
      await db.currency.updateMany({ where: { tenantId }, data: { isBase: false } })
      // Set new base
      await db.currency.update({ where: { id: currencyId }, data: { isBase: true } })
      await logAction({
        ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
        action: 'update', entityType: 'tenant', summary: `Changed base currency to ${newBaseCode}`,
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'update_rate') {
      const currency = await db.currency.findFirst({ where: { id: currencyId, tenantId } })
      if (!currency) return NextResponse.json({ error: 'Currency not found' }, { status: 404 })

      await db.exchangeRate.create({
        data: { tenantId, currencyId, rate: parseFloat(rate), date: new Date() },
      })

      await logAction({
        ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
        action: 'update', entityType: 'tenant', summary: `Updated ${currency.code} exchange rate to ${rate}`,
      })

      return NextResponse.json({ ok: true })
    }

    if (action === 'add_currency') {
      const { code, name, symbol } = body
      if (!code || !name) return NextResponse.json({ error: 'Code and name required' }, { status: 400 })

      const existing = await db.currency.findUnique({ where: { tenantId_code: { tenantId, code } } })
      if (existing) return NextResponse.json({ error: 'Currency already exists' }, { status: 400 })

      const currency = await db.currency.create({
        data: { tenantId, code, name, symbol: symbol || '$', isBase: false, isActive: true },
      })
      await db.exchangeRate.create({
        data: { tenantId, currencyId: currency.id, rate: parseFloat(rate) || 1, date: new Date() },
      })

      return NextResponse.json({ currency })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
