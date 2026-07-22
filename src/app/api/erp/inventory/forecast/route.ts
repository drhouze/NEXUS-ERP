import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

// GET /api/erp/inventory/forecast - demand forecasting based on sales velocity
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = user.role === 'OWNER' ? {} : { tenantId: user.tenantId }

  const products = await db.product.findMany({
    where: filter,
    include: {
      orderItems: {
        where: { order: { status: { in: ['delivered', 'shipped'] } } },
        select: { qty: true, order: { select: { createdAt: true } } },
      },
    },
  })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

  const forecasts = products.map(p => {
    // Calculate 30-day sales
    const sales30 = p.orderItems.filter(it => new Date(it.order.createdAt) >= thirtyDaysAgo)
    const unitsSold30 = sales30.reduce((s, it) => s + it.qty, 0)
    const dailyVelocity = unitsSold30 / 30

    // Calculate 90-day sales for trend
    const sales90 = p.orderItems.filter(it => new Date(it.order.createdAt) >= ninetyDaysAgo)
    const unitsSold90 = sales90.reduce((s, it) => s + it.qty, 0)
    const dailyVelocity90 = unitsSold90 / 90

    // Days until stock runs out (at current velocity)
    const daysUntilOut = dailyVelocity > 0 ? Math.floor(p.stockQty / dailyVelocity) : Infinity

    // Should reorder?
    const needsReorder = p.stockQty <= p.reorderLevel
    const willRunOutSoon = daysUntilOut <= 14 && daysUntilOut !== Infinity

    // Suggested reorder quantity (based on 60-day projected demand minus current stock)
    const projectedDemand60 = Math.ceil(dailyVelocity * 60)
    const suggestedOrderQty = Math.max(projectedDemand60 - p.stockQty, p.reorderQty)

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stockQty: p.stockQty,
      reorderLevel: p.reorderLevel,
      reorderQty: p.reorderQty,
      unitsSold30,
      unitsSold90,
      dailyVelocity: parseFloat(dailyVelocity.toFixed(1)),
      dailyVelocity90: parseFloat(dailyVelocity90.toFixed(1)),
      trend: dailyVelocity > dailyVelocity90 * 1.1 ? 'up' : dailyVelocity < dailyVelocity90 * 0.9 ? 'down' : 'stable',
      daysUntilOut: daysUntilOut === Infinity ? null : daysUntilOut,
      needsReorder,
      willRunOutSoon,
      suggestedOrderQty: (needsReorder || willRunOutSoon) ? suggestedOrderQty : 0,
      status: needsReorder ? 'reorder_now' : willRunOutSoon ? 'reorder_soon' : daysUntilOut < 30 ? 'monitor' : 'healthy',
    }
  })

  // Sort by urgency
  forecasts.sort((a, b) => {
    const urgency = { reorder_now: 0, reorder_soon: 1, monitor: 2, healthy: 3 }
    return urgency[a.status as keyof typeof urgency] - urgency[b.status as keyof typeof urgency]
  })

  const summary = {
    total: forecasts.length,
    reorderNow: forecasts.filter(f => f.status === 'reorder_now').length,
    reorderSoon: forecasts.filter(f => f.status === 'reorder_soon').length,
    monitor: forecasts.filter(f => f.status === 'monitor').length,
    healthy: forecasts.filter(f => f.status === 'healthy').length,
  }

  return NextResponse.json({ forecasts, summary })
}
