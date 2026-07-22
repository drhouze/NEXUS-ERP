import { db } from './db'

// ============ Default pipelines ============

export const DEFAULT_ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'amber' },
  { value: 'processing', label: 'Processing', color: 'blue' },
  { value: 'shipped', label: 'Shipped', color: 'purple' },
  { value: 'delivered', label: 'Delivered', color: 'emerald' },
  { value: 'cancelled', label: 'Cancelled', color: 'rose' },
]
export const DEFAULT_PO_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'slate' },
  { value: 'sent', label: 'Sent', color: 'blue' },
  { value: 'received', label: 'Received', color: 'emerald' },
  { value: 'cancelled', label: 'Cancelled', color: 'rose' },
]
export const DEFAULT_CUSTOMER_STATUSES = [
  { value: 'lead', label: 'Lead', color: 'amber' },
  { value: 'active', label: 'Active', color: 'emerald' },
  { value: 'inactive', label: 'Inactive', color: 'slate' },
]
export const DEFAULT_EMPLOYEE_STATUSES = [
  { value: 'active', label: 'Active', color: 'emerald' },
  { value: 'on_leave', label: 'On Leave', color: 'amber' },
  { value: 'terminated', label: 'Terminated', color: 'rose' },
]

function parseArr(v: any): any[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

/** Extract string values from pipeline entries that may be {value, label, color} objects or plain strings. */
function toValues(arr: any[]): string[] {
  return arr.map((s: any) => typeof s === 'string' ? s : s?.value || String(s))
}

/** Get-or-create the tenant's StatusPipeline row. */
export async function getOrCreatePipeline(tenantId: string) {
  let p = await db.statusPipeline.findUnique({ where: { tenantId } })
  if (!p) {
    p = await db.statusPipeline.create({
      data: {
        tenantId,
        orderStatuses: JSON.stringify(DEFAULT_ORDER_STATUSES),
        poStatuses: JSON.stringify(DEFAULT_PO_STATUSES),
        customerStatuses: JSON.stringify(DEFAULT_CUSTOMER_STATUSES),
        employeeStatuses: JSON.stringify(DEFAULT_EMPLOYEE_STATUSES),
      },
    })
  }
  return p
}

/** Returns the tenant's order status pipeline as a string array of values. */
export async function getOrderStatuses(tenantId: string): Promise<string[]> {
  const p = await getOrCreatePipeline(tenantId)
  return toValues(parseArr(p.orderStatuses))
}

/**
 * Returns the terminal status = last non-cancelled status in the order
 * pipeline. This is the status that triggers stock-out + revenue
 * recognition (instead of hardcoding 'delivered').
 */
export async function getTerminalOrderStatus(tenantId: string): Promise<string | null> {
  const statuses = await getOrderStatuses(tenantId)
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] !== 'cancelled') return statuses[i]
  }
  return statuses[statuses.length - 1] || null
}

/** Returns the tenant's PO status pipeline as a string array of values. */
export async function getPoStatuses(tenantId: string): Promise<string[]> {
  const p = await getOrCreatePipeline(tenantId)
  return toValues(parseArr(p.poStatuses))
}

/** Returns the tenant's customer status pipeline as a string array of values. */
export async function getCustomerStatuses(tenantId: string): Promise<string[]> {
  const p = await getOrCreatePipeline(tenantId)
  return toValues(parseArr(p.customerStatuses))
}

/** Returns the tenant's employee status pipeline as a string array of values. */
export async function getEmployeeStatuses(tenantId: string): Promise<string[]> {
  const p = await getOrCreatePipeline(tenantId)
  return toValues(parseArr(p.employeeStatuses))
}
