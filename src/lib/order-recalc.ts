/**
 * Shared order totals recalculation helper.
 *
 * Used by:
 *   - /api/erp/orders/route.ts (POST create)
 *   - /api/erp/orders/[id]/route.ts (PATCH update)
 *   - /api/erp/orders/[id]/items/route.ts (PATCH replace items)
 *   - /api/erp/orders/[id]/refresh-prices/route.ts (POST refresh prices)
 *
 * Always recomputes subtotal from the supplied line items, then applies the
 * order's existing (or updated) discount + tax settings to derive the final
 * total. Returns the four numeric fields the schema expects so callers can
 * spread them directly into a `db.salesOrder.update({ data: ... })` call.
 */
export interface RecalcInput {
  /** Line items with qty + unitPrice already resolved (no product lookup here). */
  items: Array<{ qty: number; unitPrice: number }>
  discountType?: string | null
  discountValue?: number | null
  taxRate?: number | null
}

export interface RecalcResult {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export function recalcOrderTotals(input: RecalcInput): RecalcResult {
  const subtotal = input.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)

  let discountAmount = 0
  const dt = input.discountType
  const dv = Number(input.discountValue) || 0
  if (dt && dv > 0) {
    if (dt === 'percentage') {
      discountAmount = subtotal * (dv / 100)
    } else if (dt === 'fixed') {
      discountAmount = Math.min(dv, subtotal) // can't discount more than subtotal
    }
  }

  const afterDiscount = subtotal - discountAmount
  const taxPct = Number(input.taxRate) || 0
  const taxAmount = afterDiscount * (taxPct / 100)
  const total = afterDiscount + taxAmount

  // Round to 2dp to avoid floating-point dust in stored values.
  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(total),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
