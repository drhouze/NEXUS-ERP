import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import { recordsToCsv, withBom } from '@/lib/csv-export'
import { parseCsv } from '@/lib/csv-import'

// GET /api/erp/backup - download tenant data as JSON (includes ALL customization)
// OWNER: ?tenantId=xxx for specific tenant, or no param for full DB
// TENANT_ADMIN: only their own tenant
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetTenantId = url.searchParams.get('tenantId')
  const format = (url.searchParams.get('format') || 'json').toLowerCase()

  let tenantIds: string[] = []
  let isFullBackup = false

  if (user.role === 'OWNER') {
    if (targetTenantId) {
      tenantIds = [targetTenantId]
    } else {
      const allTenants = await db.tenant.findMany({ select: { id: true } })
      tenantIds = allTenants.map(t => t.id)
      isFullBackup = true
    }
  } else {
    if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    tenantIds = [user.tenantId]
  }

  const tidFilter = { tenantId: { in: tenantIds } }

  const backup: any = {
    _meta: {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: { email: user.email, role: user.role },
      scope: isFullBackup ? 'full' : 'tenant',
      tenantIds,
    },
    // Core business data
    tenants: [],
    users: [],
    products: [],
    customers: [],
    suppliers: [],
    salesOrders: [],
    salesOrderItems: [],
    purchaseOrders: [],
    purchaseOrderItems: [],
    employees: [],
    transactions: [],
    activities: [],
    auditLogs: [],
    notifications: [],
    payments: [],
    // Customization & configuration
    customFields: [],
    customFieldValues: [],
    customTabs: [],
    statusPipelines: [],
    recordNotes: [],
    moduleLabels: [],
    fileAttachments: [],
    invoiceTemplate: [],
    encounterTemplates: [],
    clinicalEncounters: [],
    documentTemplates: [],
    // Financial config
    currencies: [],
    exchangeRates: [],
    duitNowSettings: [],
    // Inventory config
    warehouses: [],
    // Numbering
    numberSettings: [],
    // Rewards (tenant-owned CONFIG + HISTORY — point BALANCES are platform-owned, excluded)
    rewardConfig: [],
    rewardTasks: [],
    partnerShops: [],
    shopCatalogItems: [],
    pointTransactions: [],   // transaction history (audit trail) — tenant-owned
    redemptionCodes: [],     // redemption history — tenant-owned
  }

  // Core data
  backup.tenants = await db.tenant.findMany({ where: { id: { in: tenantIds } } })
  backup.users = await db.user.findMany({
    where: { tenantId: { in: tenantIds } },
    select: {
      id: true, email: true, name: true, role: true, tenantId: true,
      status: true, emailVerified: true, lastLoginAt: true,
      createdAt: true, updatedAt: true,
      // Include portal type + module permissions (tenant-owned config)
      portalType: true, modulePermissions: true,
      // NOTE: 'points' (Nex Coins) is PLATFORM-OWNED and EXCLUDED
    },
  })
  backup.products = await db.product.findMany({ where: tidFilter })
  backup.customers = await db.customer.findMany({ where: tidFilter })
  backup.suppliers = await db.supplier.findMany({ where: tidFilter })
  backup.employees = await db.employee.findMany({ where: tidFilter })
  backup.transactions = await db.transaction.findMany({ where: tidFilter })
  backup.activities = await db.activity.findMany({ where: tidFilter })
  backup.notifications = await db.notification.findMany({ where: tidFilter })
  backup.auditLogs = await db.auditLog.findMany({ where: tidFilter })
  backup.payments = await db.payment.findMany({ where: tidFilter })

  // Orders + items
  const orders = await db.salesOrder.findMany({ where: tidFilter })
  backup.salesOrders = orders
  if (orders.length > 0) {
    backup.salesOrderItems = await db.salesOrderItem.findMany({ where: { order: { tenantId: { in: tenantIds } } } })
  }
  const pos = await db.purchaseOrder.findMany({ where: tidFilter })
  backup.purchaseOrders = pos
  if (pos.length > 0) {
    backup.purchaseOrderItems = await db.purchaseOrderItem.findMany({ where: { po: { tenantId: { in: tenantIds } } } })
  }

  // ── Customization & configuration (THE IMPORTANT STUFF) ──
  backup.customFields = await db.customField.findMany({ where: tidFilter })
  backup.customFieldValues = await db.customFieldValue.findMany({ where: tidFilter })
  backup.customTabs = await db.customTab.findMany({ where: tidFilter })
  backup.statusPipelines = await db.statusPipeline.findMany({ where: tidFilter })
  backup.recordNotes = await db.recordNote.findMany({ where: tidFilter })
  backup.moduleLabels = await db.moduleLabel.findMany({ where: tidFilter })
  backup.fileAttachments = await db.fileAttachment.findMany({
    where: tidFilter,
    // Don't export base64 data (too large) — just metadata
    select: { id: true, tenantId: true, entityType: true, entityId: true, fileName: true, fileSize: true, mimeType: true, uploadedBy: true, createdAt: true },
  })
  backup.invoiceTemplate = await db.invoiceTemplate.findMany({ where: tidFilter })
  backup.encounterTemplates = await db.encounterTemplate.findMany({ where: tidFilter })
  backup.clinicalEncounters = await db.clinicalEncounter.findMany({ where: tidFilter })
  backup.documentTemplates = await db.documentTemplate.findMany({ where: tidFilter })

  // Financial config
  backup.currencies = await db.currency.findMany({ where: tidFilter })
  backup.exchangeRates = await db.exchangeRate.findMany({ where: tidFilter })
  backup.duitNowSettings = await db.duitNowSettings.findMany({ where: tidFilter })

  // Inventory config
  backup.warehouses = await db.warehouse.findMany({ where: tidFilter })

  // Numbering
  backup.numberSettings = await db.tenantNumberSetting.findMany({ where: tidFilter })

  // ---- Rewards (tenant-owned config + history) ----
  // NOTE: User.points (the actual balance) is PLATFORM-OWNED and NOT included
  // in tenant backups. Only the configuration and transaction history are
  // exported so the tenant can audit their rewards program. Point balances
  // are controlled by the platform to maintain economy integrity.
  backup.rewardConfig = await db.rewardConfig.findMany({ where: tidFilter })
  backup.rewardTasks = await db.rewardTask.findMany({ where: tidFilter })
  backup.partnerShops = await db.partnerShop.findMany({ where: tidFilter })
  backup.shopCatalogItems = await db.shopCatalogItem.findMany({ where: tidFilter })
  backup.pointTransactions = await db.pointTransaction.findMany({ where: tidFilter })
  backup.redemptionCodes = await db.redemptionCode.findMany({ where: tidFilter })

  // Stats
  backup._meta.stats = {
    tenants: backup.tenants.length,
    products: backup.products.length,
    customers: backup.customers.length,
    salesOrders: backup.salesOrders.length,
    customFields: backup.customFields.length,
    customFieldValues: backup.customFieldValues.length,
    encounterTemplates: backup.encounterTemplates.length,
    clinicalEncounters: backup.clinicalEncounters.length,
    invoiceTemplate: backup.invoiceTemplate.length,
    documentTemplates: backup.documentTemplates.length,
    statusPipelines: backup.statusPipelines.length,
    currencies: backup.currencies.length,
    rewardTasks: backup.rewardTasks.length,
    partnerShops: backup.partnerShops.length,
    pointTransactions: backup.pointTransactions.length,
    redemptionCodes: backup.redemptionCodes.length,
  }

  // Explicitly note that point balances are NOT included (platform-owned)
  backup._meta.pointsNote = 'Nex Coins (user point balances) are PLATFORM-OWNED and NOT included in this backup. Only reward configuration, transaction history, user accounts, and module permissions are exported. Nex Coins are linked to individual users and the tenant company account, controlled by the platform.'

  // Audit
  for (const tid of tenantIds) {
    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: tid },
      action: 'backup_export',
      entityType: 'tenant',
      entityId: tid,
      summary: `Exported ${isFullBackup ? 'full' : 'tenant'} backup (incl. customization: ${backup._meta.stats.customFields} custom fields, ${backup._meta.stats.encounterTemplates} encounter templates, ${backup._meta.stats.invoiceTemplate} invoice template, ${backup._meta.stats.documentTemplates} document templates)`,
      metadata: { scope: backup._meta.scope, stats: backup._meta.stats },
    })
  }

  if (format === 'csv') {
    return await renderCsvZip(backup, isFullBackup, tenantIds)
  }

  const filename = isFullBackup
    ? `nexus-full-backup-${new Date().toISOString().slice(0, 10)}.json`
    : `tenant-${tenantIds[0]}-backup-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * Render the backup as a ZIP archive containing one CSV file per table.
 * NOTE: User point balances are platform-owned and NOT included.
 */
async function renderCsvZip(backup: any, isFullBackup: boolean, tenantIds: string[]) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const tableNames = Object.keys(backup).filter(k => k !== '_meta')
  const readmeLines = [
    `Nexus ERP backup — CSV export`,
    `Exported at: ${backup._meta.exportedAt}`,
    `Scope: ${backup._meta.scope}`,
    ``,
    `This archive contains ${tableNames.length} CSV files, one per data table.`,
    `Each file is UTF-8 encoded with a BOM so it opens cleanly in Excel.`,
    ``,
    `IMPORTANT — Points ownership:`,
    `  User point balances are PLATFORM-OWNED and NOT included in this backup.`,
    `  Only reward configuration (tasks, shop catalog) and transaction history`,
    `  (point transactions, redemption codes) are exported for audit purposes.`,
    `  Point balances are controlled by the platform to maintain economy integrity.`,
    ``,
    `Tables included:`,
    ...tableNames.map(n => `  - ${n}.csv  (${Array.isArray(backup[n]) ? backup[n].length : 0} rows)`),
  ]
  zip.file('README.txt', readmeLines.join('\r\n'))

  for (const tableName of tableNames) {
    const rows = backup[tableName]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const csv = withBom(recordsToCsv(rows))
    zip.file(`${tableName}.csv`, csv)
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = isFullBackup
    ? `nexus-full-backup-${new Date().toISOString().slice(0, 10)}.zip`
    : `tenant-${tenantIds[0]}-backup-${new Date().toISOString().slice(0, 10)}.zip`

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}

// POST /api/erp/backup - restore/import tenant data from JSON (includes ALL customization)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const targetTenantId = body.targetTenantId || (user.role === 'OWNER' ? null : user.tenantId)
    const mode: 'insert' | 'upsert' | 'replace' = body.mode || 'upsert'

    if (!targetTenantId) {
      return NextResponse.json({ error: 'targetTenantId is required' }, { status: 400 })
    }

    // Determine backup format & reconstruct a unified `backup` object
    let backup: any
    if (body.zipBase64) {
      backup = await reconstructBackupFromZip(body.zipBase64)
    } else if (body.backup) {
      backup = body.backup
    } else {
      return NextResponse.json({ error: 'Invalid backup file format — expected { backup } or { zipBase64 }' }, { status: 400 })
    }

    if (!backup || !backup._meta) {
      return NextResponse.json({ error: 'Invalid backup file format — missing _meta section' }, { status: 400 })
    }

    const tenant = await db.tenant.findUnique({ where: { id: targetTenantId } })
    if (!tenant) return NextResponse.json({ error: 'Target tenant not found' }, { status: 404 })

    let imported: any = {
      products: 0, customers: 0, suppliers: 0, employees: 0, transactions: 0,
      // Customization
      customFields: 0, customFieldValues: 0, customTabs: 0, statusPipelines: 0,
      recordNotes: 0, moduleLabels: 0, fileAttachments: 0,
      invoiceTemplate: 0, encounterTemplates: 0, clinicalEncounters: 0, documentTemplates: 0,
      currencies: 0, exchangeRates: 0, duitNowSettings: 0,
      warehouses: 0, numberSettings: 0, payments: 0,
      // Track updates/skips for upsert mode
      updated: { products: 0, customers: 0, suppliers: 0, employees: 0 },
      skipped: { products: 0, customers: 0, suppliers: 0, employees: 0 },
      mode,
      // Explicitly note that points are NOT restored
      pointsNote: 'User point balances are platform-owned and were NOT restored. Only reward config + transaction history were imported.',
    }

    // Helper: ensure JSON-stored-as-String fields are strings (for CSV restore)
    const asStr = (v: any): string | null => {
      if (v === null || v === undefined) return null
      if (typeof v === 'string') return v
      return JSON.stringify(v)
    }

    // ── Restore customization FIRST (so fields/templates exist before data references them) ──

    // Custom Fields
    if (backup.customFields) {
      for (const cf of backup.customFields) {
        const existing = await db.customField.findUnique({
          where: { tenantId_module_fieldKey: { tenantId: targetTenantId, module: cf.module, fieldKey: cf.fieldKey } },
        })
        if (existing) continue
        await db.customField.create({
          data: {
            tenantId: targetTenantId, module: cf.module, fieldKey: cf.fieldKey,
            label: cf.label, type: cf.type, options: cf.options, defaultValue: cf.defaultValue,
            formula: cf.formula, formulaType: cf.formulaType, sourceField: cf.sourceField,
            isRequired: cf.isRequired, isFilterable: cf.isFilterable,
            showInTable: cf.showInTable, showInForm: cf.showInForm,
            sortOrder: cf.sortOrder, isActive: cf.isActive,
          },
        })
        imported.customFields++
      }
    }

    // Custom Field Values
    if (backup.customFieldValues) {
      for (const cfv of backup.customFieldValues) {
        // Need to find the customField in the target tenant by fieldKey
        const sourceCf = backup.customFields?.find((cf: any) => cf.id === cfv.customFieldId)
        if (!sourceCf) continue
        const targetCf = await db.customField.findUnique({
          where: { tenantId_module_fieldKey: { tenantId: targetTenantId, module: sourceCf.module, fieldKey: sourceCf.fieldKey } },
        })
        if (!targetCf) continue
        await db.customFieldValue.upsert({
          where: { customFieldId_entityId: { customFieldId: targetCf.id, entityId: cfv.entityId } },
          create: { tenantId: targetTenantId, customFieldId: targetCf.id, entityType: cfv.entityType, entityId: cfv.entityId, value: cfv.value },
          update: { value: cfv.value },
        })
        imported.customFieldValues++
      }
    }

    // Encounter Template (upsert — one per tenant)
    if (backup.encounterTemplates) {
      for (const et of backup.encounterTemplates) {
        await db.encounterTemplate.upsert({
          where: { tenantId: targetTenantId },
          create: {
            tenantId: targetTenantId, displayName: et.displayName,
            sections: et.sections, itemTables: et.itemTables,
            showAdvice: et.showAdvice, adviceLabel: et.adviceLabel,
            showFollowUp: et.showFollowUp, followUpLabel: et.followUpLabel,
            showOnInvoice: et.showOnInvoice,
            requireEncounterBeforeInvoice: et.requireEncounterBeforeInvoice,
            requiredSectionIds: et.requiredSectionIds,
            defaultDepositAmount: et.defaultDepositAmount,
            defaultDepositLabel: et.defaultDepositLabel,
          },
          update: {
            displayName: et.displayName, sections: et.sections, itemTables: et.itemTables,
            showAdvice: et.showAdvice, adviceLabel: et.adviceLabel,
            showFollowUp: et.showFollowUp, followUpLabel: et.followUpLabel,
            showOnInvoice: et.showOnInvoice,
            requireEncounterBeforeInvoice: et.requireEncounterBeforeInvoice,
            requiredSectionIds: et.requiredSectionIds,
            defaultDepositAmount: et.defaultDepositAmount,
            defaultDepositLabel: et.defaultDepositLabel,
          },
        })
        imported.encounterTemplates++
      }
    }

    // Invoice Template (upsert — one per tenant)
    if (backup.invoiceTemplate) {
      for (const it of backup.invoiceTemplate) {
        await db.invoiceTemplate.upsert({
          where: { tenantId: targetTenantId },
          create: {
            tenantId: targetTenantId, clinicName: it.clinicName, clinicPhone: it.clinicPhone,
            clinicAddress: it.clinicAddress, invoiceLabel: it.invoiceLabel,
            showPatientIC: it.showPatientIC, patientICLabel: it.patientICLabel,
            showClinicalNotes: it.showClinicalNotes,
            notesLabel: it.notesLabel, issueLabel: it.issueLabel, findingsLabel: it.findingsLabel,
            diagnosisLabel: it.diagnosisLabel, planLabel: it.planLabel,
            showItemNumber: it.showItemNumber, itemColLabel: it.itemColLabel,
            priceColLabel: it.priceColLabel, unitColLabel: it.unitColLabel,
            amountColLabel: it.amountColLabel, totalLabel: it.totalLabel,
            currencySymbol: it.currencySymbol, showPaymentQR: it.showPaymentQR,
            paymentInstructions: it.paymentInstructions, footerText: it.footerText,
            primaryColor: it.primaryColor, fontSize: it.fontSize,
            patientCustomFields: it.patientCustomFields,
          },
          update: {
            clinicName: it.clinicName, clinicPhone: it.clinicPhone, clinicAddress: it.clinicAddress,
            invoiceLabel: it.invoiceLabel, showPatientIC: it.showPatientIC,
            primaryColor: it.primaryColor, currencySymbol: it.currencySymbol,
            patientCustomFields: it.patientCustomFields,
          },
        })
        imported.invoiceTemplate++
      }
    }

    // Document Templates
    if (backup.documentTemplates) {
      for (const dt of backup.documentTemplates) {
        await db.documentTemplate.upsert({
          where: { tenantId_docType: { tenantId: targetTenantId, docType: dt.docType } },
          create: { tenantId: targetTenantId, docType: dt.docType, config: dt.config, isActive: dt.isActive },
          update: { config: dt.config, isActive: dt.isActive },
        })
        imported.documentTemplates++
      }
    }

    // Status Pipeline (upsert — one per tenant)
    if (backup.statusPipelines) {
      for (const sp of backup.statusPipelines) {
        await db.statusPipeline.upsert({
          where: { tenantId: targetTenantId },
          create: { tenantId: targetTenantId, orderStatuses: sp.orderStatuses, poStatuses: sp.poStatuses, customerStatuses: sp.customerStatuses, employeeStatuses: sp.employeeStatuses },
          update: { orderStatuses: sp.orderStatuses, poStatuses: sp.poStatuses, customerStatuses: sp.customerStatuses, employeeStatuses: sp.employeeStatuses },
        })
        imported.statusPipelines++
      }
    }

    // Module Labels
    if (backup.moduleLabels) {
      for (const ml of backup.moduleLabels) {
        await db.moduleLabel.upsert({
          where: { tenantId_moduleKey: { tenantId: targetTenantId, moduleKey: ml.moduleKey } },
          create: { tenantId: targetTenantId, moduleKey: ml.moduleKey, label: ml.label, description: ml.description },
          update: { label: ml.label, description: ml.description },
        })
        imported.moduleLabels++
      }
    }

    // Custom Tabs
    if (backup.customTabs) {
      for (const ct of backup.customTabs) {
        await db.customTab.create({ data: { tenantId: targetTenantId, module: ct.module, label: ct.label, content: ct.content, sortOrder: ct.sortOrder, isActive: ct.isActive } })
        imported.customTabs++
      }
    }

    // Currencies
    if (backup.currencies) {
      for (const c of backup.currencies) {
        const existing = await db.currency.findUnique({ where: { tenantId_code: { tenantId: targetTenantId, code: c.code } } })
        if (existing) {
          await db.currency.update({ where: { id: existing.id }, data: { isBase: c.isBase, isActive: c.isActive, name: c.name, symbol: c.symbol } })
        } else {
          await db.currency.create({ data: { tenantId: targetTenantId, code: c.code, name: c.name, symbol: c.symbol, isBase: c.isBase, isActive: c.isActive } })
          imported.currencies++
        }
      }
    }

    // Warehouses
    if (backup.warehouses) {
      for (const w of backup.warehouses) {
        const existing = await db.warehouse.findUnique({ where: { tenantId_code: { tenantId: targetTenantId, code: w.code } } })
        if (existing) continue
        await db.warehouse.create({ data: { tenantId: targetTenantId, code: w.code, name: w.name, address: w.address, isDefault: w.isDefault, isActive: w.isActive !== undefined ? w.isActive : true } })
        imported.warehouses++
      }
    }

    // Number Settings
    if (backup.numberSettings) {
      for (const ns of backup.numberSettings) {
        await db.tenantNumberSetting.upsert({
          where: { tenantId: targetTenantId },
          create: { tenantId: targetTenantId, productPrefix: ns.productPrefix, salesOrderPrefix: ns.salesOrderPrefix, poPrefix: ns.poPrefix, customerPrefix: ns.customerPrefix, employeePrefix: ns.employeePrefix },
          update: { productPrefix: ns.productPrefix, salesOrderPrefix: ns.salesOrderPrefix, poPrefix: ns.poPrefix },
        })
        imported.numberSettings++
      }
    }

    // ── Restore core business data ──

    // Products (with packSize, productType, etc.)
    if (backup.products) {
      for (const p of backup.products) {
        const existing = await db.product.findUnique({ where: { tenantId_sku: { tenantId: targetTenantId, sku: p.sku } } })
        if (existing) continue
        await db.product.create({
          data: {
            tenantId: targetTenantId, sku: p.sku, name: p.name, category: p.category,
            price: p.price, cost: p.cost, stockQty: p.stockQty, reorderLevel: p.reorderLevel,
            reorderQty: p.reorderQty || 50, warehouse: p.warehouse, warehouseId: p.warehouseId,
            supplierId: null, productType: p.productType || 'physical',
            packSize: p.packSize, packUnit: p.packUnit, baseUnit: p.baseUnit,
          },
        })
        imported.products++
      }
    }

    // Customers (with all CRM fields)
    if (backup.customers) {
      for (const c of backup.customers) {
        const existing = await db.customer.findUnique({ where: { tenantId_email: { tenantId: targetTenantId, email: c.email } } })
        if (existing) continue
        await db.customer.create({
          data: {
            tenantId: targetTenantId, name: c.name, email: c.email, phone: c.phone,
            company: c.company, status: c.status, totalSpent: c.totalSpent || 0,
            dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
            gender: c.gender, idType: c.idType, idNumber: c.idNumber,
            nationality: c.nationality, occupation: c.occupation,
            lifecycleStage: c.lifecycleStage, leadSource: c.leadSource,
            ownerId: c.ownerId, tags: c.tags, lastContactAt: c.lastContactAt ? new Date(c.lastContactAt) : null,
          },
        })
        imported.customers++
      }
    }

    // Suppliers
    if (backup.suppliers) {
      for (const s of backup.suppliers) {
        const existing = await db.supplier.findUnique({ where: { tenantId_name: { tenantId: targetTenantId, name: s.name } } })
        if (existing) continue
        await db.supplier.create({ data: { tenantId: targetTenantId, name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, country: s.country, rating: s.rating } })
        imported.suppliers++
      }
    }

    // Employees
    if (backup.employees) {
      for (const e of backup.employees) {
        await db.employee.create({ data: { tenantId: targetTenantId, name: e.name, email: e.email, department: e.department, role: e.role, salary: e.salary, hireDate: new Date(e.hireDate), status: e.status } })
        imported.employees++
      }
    }

    // Transactions
    if (backup.transactions) {
      for (const t of backup.transactions) {
        await db.transaction.create({ data: { tenantId: targetTenantId, type: t.type, category: t.category, amount: t.amount, description: t.description, date: new Date(t.date), refType: t.refType, refId: null } })
        imported.transactions++
      }
    }

    // ── Restore rewards CONFIG (not balances — those are platform-owned) ──
    // Reward config, tasks, partner shops, catalog items = tenant-owned configuration
    if (backup.rewardConfig) {
      for (const rc of backup.rewardConfig) {
        await db.rewardConfig.upsert({
          where: { tenantId: targetTenantId },
          create: { tenantId: targetTenantId, isEnabled: rc.isEnabled, pointsPerVisit: rc.pointsPerVisit, pointsLabel: rc.pointsLabel, shopName: rc.shopName },
          update: { isEnabled: rc.isEnabled, pointsPerVisit: rc.pointsPerVisit, pointsLabel: rc.pointsLabel, shopName: rc.shopName },
        })
      }
    }
    if (backup.rewardTasks) {
      for (const rt of backup.rewardTasks) {
        const existing = await db.rewardTask.findFirst({ where: { tenantId: targetTenantId, name: rt.name } })
        if (existing) {
          if (mode === 'upsert' || mode === 'replace') {
            await db.rewardTask.update({ where: { id: existing.id }, data: { points: rt.points, description: rt.description, triggerType: rt.triggerType, isActive: rt.isActive } })
          }
        } else {
          await db.rewardTask.create({ data: { tenantId: targetTenantId, name: rt.name, description: rt.description, points: rt.points, triggerType: rt.triggerType, isActive: rt.isActive } })
        }
      }
    }
    if (backup.partnerShops) {
      for (const ps of backup.partnerShops) {
        const existing = await db.partnerShop.findFirst({ where: { tenantId: targetTenantId, name: ps.name } })
        if (!existing) {
          // Only restore if the shop owner exists in this tenant
          const owner = await db.user.findFirst({ where: { tenantId: targetTenantId, email: ps.ownerEmail || '' } })
          if (owner) {
            await db.partnerShop.create({ data: { tenantId: targetTenantId, name: ps.name, description: ps.description, category: ps.category, ownerUserId: owner.id, isGlobal: ps.isGlobal, isActive: ps.isActive } })
          }
        }
      }
    }
    if (backup.shopCatalogItems) {
      for (const item of backup.shopCatalogItems) {
        // Find the shop by name in the target tenant (IDs won't match)
        const sourceShop = backup.partnerShops?.find((s: any) => s.id === item.shopId)
        if (!sourceShop) continue
        const targetShop = await db.partnerShop.findFirst({ where: { tenantId: targetTenantId, name: sourceShop.name } })
        if (!targetShop) continue
        const existing = await db.shopCatalogItem.findFirst({ where: { shopId: targetShop.id, name: item.name } })
        if (!existing) {
          await db.shopCatalogItem.create({ data: { tenantId: targetTenantId, shopId: targetShop.id, name: item.name, description: item.description, rewardType: item.rewardType, rewardDetails: item.rewardDetails, pointsCost: item.pointsCost, imageUrl: item.imageUrl, stock: item.stock, isActive: item.isActive } })
        }
      }
    }
    // Point transaction HISTORY — restore for audit (read-only, doesn't affect balances)
    if (backup.pointTransactions) {
      for (const pt of backup.pointTransactions) {
        await db.pointTransaction.create({ data: { tenantId: targetTenantId, userId: pt.userId, type: pt.type, amount: pt.amount, description: pt.description, refType: pt.refType, refId: pt.refId } })
      }
    }
    // Redemption code HISTORY — restore for audit
    if (backup.redemptionCodes) {
      for (const rc of backup.redemptionCodes) {
        await db.redemptionCode.create({ data: { tenantId: targetTenantId, code: rc.code + '-R', token: rc.token + '-R', employeeId: rc.employeeId, shopId: rc.shopId, itemId: rc.itemId, pointsCost: rc.pointsCost, status: rc.status, scannedAt: rc.scannedAt, scannedBy: rc.scannedBy, confirmedAt: rc.confirmedAt, cancelledAt: rc.cancelledAt } })
      }
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: targetTenantId },
      action: 'backup_import',
      entityType: 'tenant',
      entityId: targetTenantId,
      summary: `Imported backup into "${tenant.name}" (mode: ${mode}): ${imported.products} products, ${imported.customers} customers, reward config + ${backup.rewardTasks?.length || 0} tasks, ${backup.pointTransactions?.length || 0} point transactions (history only — balances are platform-controlled)`,
      metadata: { imported, source: backup._meta, mode },
    })

    return NextResponse.json({ ok: true, imported })
  } catch (e: any) {
    console.error('Restore backup error:', e?.message)
    return NextResponse.json({ error: 'Server error', detail: e?.message }, { status: 500 })
  }
}

/**
 * Reconstruct a backup object from a base64-encoded ZIP of CSV files.
 * Returns an object shaped like the JSON backup so the downstream restore
 * logic doesn't need to care which format was uploaded.
 */
async function reconstructBackupFromZip(zipBase64: string): Promise<any> {
  const JSZip = (await import('jszip')).default

  const b64 = zipBase64.replace(/^data:application\/zip;base64,/, '').replace(/^data:;base64,/, '')
  const zipBuffer = Buffer.from(b64, 'base64')
  const zip = await JSZip.loadAsync(zipBuffer)

  const backup: any = { _meta: { version: '2.0', format: 'csv-zip' } }

  // Parse README.txt for _meta fields
  const readmeFile = zip.file('README.txt')
  if (readmeFile) {
    let readme = await readmeFile.async('string')
    if (readme.charCodeAt(0) === 0xfeff) readme = readme.slice(1)
    const m = {
      exportedAt: readme.match(/Exported at:\s*(.+)/),
      scope: readme.match(/Scope:\s*(.+)/),
    }
    if (m.exportedAt) backup._meta.exportedAt = m.exportedAt[1].trim()
    if (m.scope) backup._meta.scope = m.scope[1].trim()
  }

  // Parse every CSV file into the backup object
  const csvFiles = Object.keys(zip.files).filter(name =>
    name.endsWith('.csv') && !zip.files[name].dir
  )

  for (const filename of csvFiles) {
    const tableName = filename.replace(/\.csv$/, '')
    const file = zip.files[filename]
    const csvText = await file.async('string')
    backup[tableName] = parseCsv(csvText)
  }

  backup._meta.stats = {
    tenants: backup.tenants?.length || 0,
    products: backup.products?.length || 0,
    customers: backup.customers?.length || 0,
  }

  return backup
}
