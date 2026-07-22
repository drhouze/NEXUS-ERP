/**
 * One-off script: align Numbering prefixes + Module labels for medical-industry
 * tenants (DR HOUZE = acme, HealthPrime Clinic = stark) with the medical
 * convention (VST- for visits, PAT- for patients, etc.).
 *
 * The seeded visits already use VST-xxx numbers, so we keep the counter as-is
 * (don't reset it). We only swap the prefix the *next* record will use.
 *
 * Run with: npx tsx scripts/align-medical-numbering.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const MEDICAL_TENANTS = ['acme', 'stark']

const MEDICAL_NUMBERING = {
  salesOrderPrefix: 'VST-',
  salesOrderStart: 1,
  // customerPrefix for medical = patient
  customerPrefix: 'PAT-',
  customerStart: 1000,
  // product = medication / supplies
  productPrefix: 'MED-',
  productStart: 1000,
}

const MEDICAL_LABELS = [
  { moduleKey: 'orders', label: 'Visits' },
  { moduleKey: 'customers', label: 'Patients' },
  { moduleKey: 'inventory', label: 'Pharmacy' },
  { moduleKey: 'purchasing', label: 'Procurement' },
  { moduleKey: 'finance', label: 'Billing' },
]

async function main() {
  for (const tenantId of MEDICAL_TENANTS) {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      console.log(`[skip] tenant ${tenantId} not found`)
      continue
    }
    console.log(`\n[align] ${tenant.name} (${tenantId}) — industry=${tenant.industry}`)

    // ---- Numbering ----
    const ns = await db.tenantNumberSetting.findUnique({ where: { tenantId } })
    if (ns) {
      // Only update if the current prefix is the generic default 'SO-' or 'CUST-'/'SKU-'.
      // Don't override prefixes the tenant admin has already customized.
      const patch: any = {}
      if (ns.salesOrderPrefix === 'SO-') {
        patch.salesOrderPrefix = MEDICAL_NUMBERING.salesOrderPrefix
        // Keep counter as-is — seeded visits already used VST-001..003 etc.
      }
      if (ns.customerPrefix === 'CUST-') patch.customerPrefix = MEDICAL_NUMBERING.customerPrefix
      if (ns.productPrefix === 'SKU-') patch.productPrefix = MEDICAL_NUMBERING.productPrefix
      if (Object.keys(patch).length > 0) {
        await db.tenantNumberSetting.update({ where: { tenantId }, data: patch })
        console.log(`  numbering: applied ${JSON.stringify(patch)}`)
      } else {
        console.log(`  numbering: no generic-default prefixes to swap (already customized)`)
      }
    } else {
      // Auto-create with medical defaults.
      await db.tenantNumberSetting.create({
        data: {
          tenantId,
          salesOrderPrefix: MEDICAL_NUMBERING.salesOrderPrefix,
          salesOrderStart: MEDICAL_NUMBERING.salesOrderStart,
          customerPrefix: MEDICAL_NUMBERING.customerPrefix,
          customerStart: MEDICAL_NUMBERING.customerStart,
          productPrefix: MEDICAL_NUMBERING.productPrefix,
          productStart: MEDICAL_NUMBERING.productStart,
        },
      })
      console.log(`  numbering: created with medical defaults`)
    }

    // ---- Module labels (upsert) ----
    for (const { moduleKey, label } of MEDICAL_LABELS) {
      const existing = await db.moduleLabel.findUnique({
        where: { tenantId_moduleKey: { tenantId, moduleKey } },
      })
      if (existing) {
        if (existing.label !== label) {
          await db.moduleLabel.update({ where: { id: existing.id }, data: { label } })
          console.log(`  label ${moduleKey}: ${existing.label} → ${label}`)
        }
      } else {
        await db.moduleLabel.create({ data: { tenantId, moduleKey, label } })
        console.log(`  label ${moduleKey}: created as ${label}`)
      }
    }
  }
  console.log('\n✓ Done')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => process.exit(0))
