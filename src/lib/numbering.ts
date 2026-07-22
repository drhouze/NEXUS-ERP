import { db } from './db'

// Get or create default number settings for a tenant
export async function getNumberSettings(tenantId: string) {
  let settings = await db.tenantNumberSetting.findUnique({ where: { tenantId } })
  if (!settings) {
    settings = await db.tenantNumberSetting.create({ data: { tenantId } })
  }
  return settings
}

// Generate the next number for a given entity type and increment the counter
// Returns the formatted number string (e.g. "SO-1001")
export async function generateNumber(tenantId: string, entityType: string): Promise<string> {
  const settings = await getNumberSettings(tenantId)

  const config: Record<string, { prefix: string; start: number; counter: string }> = {
    salesOrder:     { prefix: 'salesOrderPrefix',     start: 'salesOrderStart',     counter: 'salesOrderCounter' },
    purchaseOrder:  { prefix: 'purchaseOrderPrefix',  start: 'purchaseOrderStart',  counter: 'purchaseOrderCounter' },
    invoice:        { prefix: 'invoicePrefix',        start: 'invoiceStart',        counter: 'invoiceCounter' },
    customer:       { prefix: 'customerPrefix',       start: 'customerStart',       counter: 'customerCounter' },
    supplier:       { prefix: 'supplierPrefix',       start: 'supplierStart',       counter: 'supplierCounter' },
    product:        { prefix: 'productPrefix',        start: 'productStart',        counter: 'productCounter' },
    employee:       { prefix: 'employeePrefix',       start: 'employeeStart',       counter: 'employeeCounter' },
    transaction:    { prefix: 'transactionPrefix',    start: 'transactionStart',    counter: 'transactionCounter' },
  }

  const cfg = config[entityType]
  if (!cfg) throw new Error(`Unknown entity type: ${entityType}`)

  const prefix = (settings as any)[cfg.prefix] as string
  const startNum = (settings as any)[cfg.start] as number
  const currentCounter = (settings as any)[cfg.counter] as number

  // Next number = start + counter (so first one is start, second is start+1, etc.)
  const nextNum = startNum + currentCounter
  const formatted = `${prefix}${nextNum}`

  // Increment counter
  await db.tenantNumberSetting.update({
    where: { tenantId },
    data: { [cfg.counter]: currentCounter + 1 } as any,
  })

  return formatted
}

// Preview the NEXT number without incrementing (for forms to show "will be SO-1005")
export async function previewNextNumber(tenantId: string, entityType: string): Promise<string> {
  const settings = await getNumberSettings(tenantId)

  const config: Record<string, { prefix: string; start: string; counter: string }> = {
    salesOrder:     { prefix: 'salesOrderPrefix',     start: 'salesOrderStart',     counter: 'salesOrderCounter' },
    purchaseOrder:  { prefix: 'purchaseOrderPrefix',  start: 'purchaseOrderStart',  counter: 'purchaseOrderCounter' },
    invoice:        { prefix: 'invoicePrefix',        start: 'invoiceStart',        counter: 'invoiceCounter' },
    customer:       { prefix: 'customerPrefix',       start: 'customerStart',       counter: 'customerCounter' },
    supplier:       { prefix: 'supplierPrefix',       start: 'supplierStart',       counter: 'supplierCounter' },
    product:        { prefix: 'productPrefix',        start: 'productStart',        counter: 'productCounter' },
    employee:       { prefix: 'employeePrefix',       start: 'employeeStart',       counter: 'employeeCounter' },
    transaction:    { prefix: 'transactionPrefix',    start: 'transactionStart',    counter: 'transactionCounter' },
  }

  const cfg = config[entityType]
  if (!cfg) return ''

  const prefix = (settings as any)[cfg.prefix] as string
  const startNum = (settings as any)[cfg.start] as number
  const currentCounter = (settings as any)[cfg.counter] as number
  const nextNum = startNum + currentCounter

  return `${prefix}${nextNum}`
}
