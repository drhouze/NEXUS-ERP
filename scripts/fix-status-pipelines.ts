/**
 * One-off script: ensure every tenant has a StatusPipeline row with all four
 * status arrays populated. If any array is empty (or missing), reset it to the
 * appropriate default. Leaves non-empty arrays alone (tenant has customized).
 */
import { PrismaClient } from '@prisma/client'
import {
  DEFAULT_ORDER_STATUSES,
  DEFAULT_PO_STATUSES,
  DEFAULT_CUSTOMER_STATUSES,
  DEFAULT_EMPLOYEE_STATUSES,
} from '../src/lib/status-pipeline'

const db = new PrismaClient()

async function main() {
  const tenants = await db.tenant.findMany({ select: { id: true, name: true } })
  for (const t of tenants) {
    let p = await db.statusPipeline.findUnique({ where: { tenantId: t.id } })
    if (!p) {
      p = await db.statusPipeline.create({
        data: {
          tenantId: t.id,
          orderStatuses: JSON.stringify(DEFAULT_ORDER_STATUSES),
          poStatuses: JSON.stringify(DEFAULT_PO_STATUSES),
          customerStatuses: JSON.stringify(DEFAULT_CUSTOMER_STATUSES),
          employeeStatuses: JSON.stringify(DEFAULT_EMPLOYEE_STATUSES),
        },
      })
      console.log(`[${t.id}] ${t.name}: created pipeline with all defaults`)
      continue
    }

    const patch: any = {}
    const parse = (v: any) => {
      if (!v) return []
      if (Array.isArray(v)) return v
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
    }

    if (parse(p.orderStatuses).length === 0) {
      patch.orderStatuses = JSON.stringify(DEFAULT_ORDER_STATUSES)
    }
    if (parse(p.poStatuses).length === 0) {
      patch.poStatuses = JSON.stringify(DEFAULT_PO_STATUSES)
    }
    if (parse(p.customerStatuses).length === 0) {
      patch.customerStatuses = JSON.stringify(DEFAULT_CUSTOMER_STATUSES)
    }
    if (parse(p.employeeStatuses).length === 0) {
      patch.employeeStatuses = JSON.stringify(DEFAULT_EMPLOYEE_STATUSES)
    }

    if (Object.keys(patch).length > 0) {
      await db.statusPipeline.update({ where: { id: p.id }, data: patch })
      console.log(`[${t.id}] ${t.name}: reset ${Object.keys(patch).join(', ')} to defaults`)
    } else {
      console.log(`[${t.id}] ${t.name}: all 4 pipelines already populated`)
    }
  }
  console.log('\n✓ Done')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
