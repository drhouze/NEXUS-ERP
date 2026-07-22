import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

function parseArr<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const p = JSON.parse(v)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}
function parseObj(v: any): any {
  if (!v) return {}
  if (typeof v === 'object') return v
  try {
    return JSON.parse(v)
  } catch {
    return {}
  }
}

/**
 * GET /api/erp/clinical-encounter/[orderId]
 *
 * Loads everything the encounter dialog needs:
 *   - order (with customer)
 *   - encounter (if any) — parsed `data` JSON
 *   - encounter template (parsed sections / itemTables)
 *   - patient custom field values
 *   - product catalogue with pack info + clinical custom-field values
 *     (route / strength / dosage_form etc.)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orderId } = await params

  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { customer: true, items: { include: { product: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ---- Encounter template (auto-create blank if missing) ----
  let template = await db.encounterTemplate.findUnique({ where: { tenantId: order.tenantId } })
  if (!template) {
    template = await db.encounterTemplate.create({ data: { tenantId: order.tenantId } })
  }

  // ---- Encounter row (1:1 with order) ----
  const encounterRow = await db.clinicalEncounter.findUnique({
    where: { orderId: order.id },
  })
  let encounter: any = null
  if (encounterRow) {
    const data = parseObj(encounterRow.data)
    encounter = {
      ...encounterRow,
      data,
      sectionValues: data.sectionValues || {},
      tableRows: data.tableRows || {},
      followUpDate: encounterRow.followUpDate ? encounterRow.followUpDate.toISOString().slice(0, 10) : '',
    }
  }

  // ---- Patient custom-field values ----
  const patientFields = await db.customField.findMany({
    where: { tenantId: order.tenantId, module: 'customer', isActive: true },
  })
  const patientValuesRows = await db.customFieldValue.findMany({
    where: { tenantId: order.tenantId, entityType: 'customer', entityId: order.customerId },
    include: { customField: { select: { fieldKey: true } } },
  })
  const patientCustomValues: Record<string, string> = {}
  for (const r of patientValuesRows) {
    const key = r.customField?.fieldKey
    if (key) patientCustomValues[key] = r.value
  }

  // ---- Product catalogue with pack info + clinical custom-field values ----
  const products = await db.product.findMany({
    where: { tenantId: order.tenantId },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      packSize: true,
      packUnit: true,
      baseUnit: true,
      productType: true,
    },
    orderBy: { name: 'asc' },
  })

  // Clinical custom-field defs (route, strength, dosage_form, packaging…)
  const clinicalFieldDefs = await db.customField.findMany({
    where: { tenantId: order.tenantId, module: 'product', isActive: true },
  })
  const clinicalFieldIds = clinicalFieldDefs.map(f => f.id)
  const productIdList = products.map(p => p.id)

  // Fetch all product custom-field values in one query (avoids N+1).
  const clinicalValuesRows =
    clinicalFieldIds.length > 0 && productIdList.length > 0
      ? await db.customFieldValue.findMany({
          where: {
            tenantId: order.tenantId,
            entityType: 'product',
            entityId: { in: productIdList },
            customFieldId: { in: clinicalFieldIds },
          },
          include: { customField: { select: { fieldKey: true } } },
        })
      : []

  // Build a map: productId → { fieldKey: value }
  const productCustomMap: Record<string, Record<string, string>> = {}
  for (const r of clinicalValuesRows) {
    const key = r.customField?.fieldKey
    if (!key) continue
    if (!productCustomMap[r.entityId]) productCustomMap[r.entityId] = {}
    productCustomMap[r.entityId][key] = r.value
  }

  const productsWithAttrs = products.map(p => ({
    ...p,
    unit: p.packUnit,
    customFields: productCustomMap[p.id] || {},
  }))

  return NextResponse.json({
    order,
    encounter,
    template: {
      ...template,
      sections: parseArr(template.sections),
      itemTables: parseArr(template.itemTables),
      requiredSectionIds: parseArr(template.requiredSectionIds),
    },
    patient: {
      ...order.customer,
      customValues: patientCustomValues,
      customFieldDefs: patientFields,
    },
    products: productsWithAttrs,
  })
}

/**
 * PUT (or POST) /api/erp/clinical-encounter/[orderId]
 *
 * Body: {
 *   sectionValues, tableRows, advice, followUpDate, followUpNotes,
 *   doctorName, doctorId, syncToInvoice
 * }
 *
 * - Upserts the encounter row, storing everything in a single `data` JSON.
 * - When syncToInvoice=true, prescription items (rows with a product column)
 *   are ADDED to the existing order items (not replace). Pack-based billing:
 *     packs = ceil(prescribedQty / packSize); lineTotal = packs × pricePerPack.
 *   New order total = existing items total + prescription total.
 */
async function upsertEncounter(orderId: string, user: any, body: any) {
  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (user.role !== 'OWNER' && order.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ---- Encounter template (needed to know which columns are product/qty) ----
  let template = await db.encounterTemplate.findUnique({ where: { tenantId: order.tenantId } })
  if (!template) {
    template = await db.encounterTemplate.create({ data: { tenantId: order.tenantId } })
  }
  const itemTables = parseArr<any>(template.itemTables)

  // ---- Compose the generic data payload ----
  const data: any = {
    sectionValues: body.sectionValues || {},
    tableRows: body.tableRows || {},
  }

  const followUpDate = body.followUpDate ? new Date(body.followUpDate) : null

  // ---- Upsert the encounter row ----
  const existing = await db.clinicalEncounter.findUnique({ where: { orderId: order.id } })
  let encounter
  if (existing) {
    encounter = await db.clinicalEncounter.update({
      where: { orderId: order.id },
      data: {
        data: JSON.stringify(data),
        advice: body.advice != null ? String(body.advice) : existing.advice,
        followUpDate: body.followUpDate !== undefined ? followUpDate : existing.followUpDate,
        followUpNotes: body.followUpNotes != null ? String(body.followUpNotes) : existing.followUpNotes,
        doctorId: body.doctorId !== undefined ? (body.doctorId || null) : existing.doctorId,
        doctorName: body.doctorName !== undefined ? (body.doctorName || null) : existing.doctorName,
      },
    })
  } else {
    encounter = await db.clinicalEncounter.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        patientId: order.customerId,
        doctorId: body.doctorId || null,
        doctorName: body.doctorName || null,
        data: JSON.stringify(data),
        advice: body.advice ? String(body.advice) : null,
        followUpDate,
        followUpNotes: body.followUpNotes ? String(body.followUpNotes) : null,
      },
    })
  }

  // ---- Sync prescription items to the order (ADD, not replace) ----
  let addedItems: any[] = []
  let prescriptionTotal = 0
  let newTotal = order.total

  if (body.syncToInvoice) {
    // Gather all (productId, qty) pairs from every item-table's rows.
    const pairs: { productId: string; qty: number }[] = []
    for (const tb of itemTables) {
      const rows = (body.tableRows || {})[tb.id] || []
      const productCol = (tb.columns || []).find((c: any) => c.type === 'product')
      const qtyCol = (tb.columns || []).find((c: any) => c.type === 'number')
      if (!productCol) continue
      for (const r of rows) {
        const pid = r[productCol.id]
        if (!pid) continue
        const qty = qtyCol ? Number(r[qtyCol.id] || 0) : 1
        if (qty <= 0) continue
        pairs.push({ productId: String(pid), qty })
      }
    }

    if (pairs.length > 0) {
      const productIds = pairs.map(p => p.productId)
      const products = await db.product.findMany({
        where: { id: { in: productIds }, tenantId: order.tenantId },
        select: { id: true, name: true, price: true, packSize: true },
      })
      const byId = new Map(products.map(p => [p.id, p]))

      const lineItems = pairs.map(p => {
        const prod = byId.get(p.productId)
        const packSize = prod?.packSize && prod.packSize > 0 ? prod.packSize : 1
        // Pack-based billing: round up to whole packs.
        const packs = Math.ceil(p.qty / packSize)
        const unitPrice = prod?.price || 0
        return {
          productId: p.productId,
          qty: packs, // bill whole packs
          unitPrice,
          lineTotal: packs * unitPrice,
          prescribedQty: p.qty,
          packSize,
        }
      })

      prescriptionTotal = lineItems.reduce((s, it) => s + it.lineTotal, 0)

      // Create the new items + compute new total.
      await db.salesOrderItem.createMany({
        data: lineItems.map(it => ({ orderId: order.id, productId: it.productId, qty: it.qty, unitPrice: it.unitPrice })),
      })

      const existingItemsTotal = order.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
      newTotal = existingItemsTotal + prescriptionTotal
      await db.salesOrder.update({ where: { id: order.id }, data: { total: newTotal } })

      addedItems = lineItems
    }
  }

  await logAction({
    ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: order.tenantId },
    action: existing ? 'update' : 'create',
    entityType: 'encounter',
    entityId: encounter.id,
    entityName: order.orderNumber,
    summary: `${existing ? 'Updated' : 'Created'} encounter for ${order.orderNumber}` +
      (addedItems.length ? ` (+${addedItems.length} items, +${prescriptionTotal.toFixed(2)})` : ''),
    metadata: {
      orderId: order.id,
      synced: !!body.syncToInvoice,
      addedItems: addedItems.length,
      prescriptionTotal,
      newTotal,
    },
  })

  // ---- Award reward points to the doctor for completing the service form ----
  // Only on FIRST creation (not updates) to prevent farming points by re-saving.
  // Points are determined by:
  //   1. Look for an active RewardTask with triggerType='visit_created' — use its points
  //   2. Fall back to rewardConfig.pointsPerVisit (legacy default: 10)
  if (!existing) {
    let rewardConfig = await db.rewardConfig.findUnique({ where: { tenantId: order.tenantId } })
    if (!rewardConfig) {
      rewardConfig = await db.rewardConfig.create({ data: { tenantId: order.tenantId } })
    }
    if (rewardConfig.isEnabled) {
      // Check if there's a task-based point config for visit_created
      const visitTask = await db.rewardTask.findFirst({
        where: { tenantId: order.tenantId, triggerType: 'visit_created', isActive: true },
      })
      const pts = visitTask ? visitTask.points : rewardConfig.pointsPerVisit
      const desc = visitTask
        ? `${visitTask.name}: ${order.orderNumber}`
        : `Completed service form for ${order.orderNumber}`

      await db.user.update({
        where: { id: user.id },
        data: { points: { increment: pts } },
      })
      await db.pointTransaction.create({
        data: {
          tenantId: order.tenantId,
          userId: user.id,
          type: 'earned',
          amount: pts,
          description: desc,
          refType: 'encounter',
          refId: encounter.id,
        },
      })
    }
  }

  return NextResponse.json({
    encounter,
    addedItems,
    prescriptionTotal,
    newTotal,
    synced: !!body.syncToInvoice,
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { orderId } = await ctx.params
  try {
    const body = await req.json()
    return await upsertEncounter(orderId, user, body)
  } catch (e: any) {
    console.error('Save encounter error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

// POST alias — the EncounterDialog component posts (not PUTs).
export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(user.role, 'orders')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { orderId } = await ctx.params
  try {
    const body = await req.json()
    return await upsertEncounter(orderId, user, body)
  } catch (e: any) {
    console.error('Save encounter (POST) error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
