// ============================================================
// REBUILD: Add all customization + CRM + encounter models to schema
// ============================================================
// This script reads the current schema, appends the missing models,
// and adds missing fields to existing models (Customer, SalesOrder, Product, etc.)

import * as fs from 'fs'
import * as path from 'path'

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
let schema = fs.readFileSync(schemaPath, 'utf8')

// 1. Add relations to Tenant model
const tenantRelations = `
  customFields    CustomField[]
  customTabs      CustomTab[]
  statusPipelines StatusPipeline[]
  recordNotes     RecordNote[]
  moduleLabels    ModuleLabel[]
  fileAttachments FileAttachment[]
  invoiceTemplate InvoiceTemplate?
  encounters     ClinicalEncounter[]
  encounterTemplate EncounterTemplate?
  documentTemplates DocumentTemplate[]`

// Insert before the closing brace of Tenant model
schema = schema.replace(
  /  duitNowSettings DuitNowSettings\?\n\}/,
  `  duitNowSettings DuitNowSettings?${tenantRelations}\n}`
)

// 2. Add fields to Customer model
schema = schema.replace(
  /model Customer \{[\s\S]*?@@unique\(\[tenantId, email\]\)\n\}/,
  `model Customer {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  email      String
  phone      String
  company    String
  status     String   @default("lead") // lead | active | inactive
  totalSpent Float    @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // First-class personal info
  dateOfBirth DateTime?
  gender      String?
  idType      String?     // IC | Passport | Other
  idNumber    String?
  nationality String?
  occupation  String?

  // CRM lifecycle
  lifecycleStage String?  @default("lead")
  leadSource     String?
  ownerId        String?
  tags           String?  // JSON array
  lastContactAt  DateTime?

  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  orders     SalesOrder[]
  encounters ClinicalEncounter[]

  @@unique([tenantId, email])
}`)

// 3. Add encounter relation to SalesOrder
schema = schema.replace(
  /  items       SalesOrderItem\[\]\n  payments    Payment\[\]\n\n  @@unique\(\[tenantId, orderNumber\]\)\n\}/,
  `  items       SalesOrderItem[]
  payments    Payment[]
  encounter   ClinicalEncounter?

  @@unique([tenantId, orderNumber])
}`)

// 4. Add productType + packSize fields to Product
schema = schema.replace(
  /  supplierId   String\?\n  createdAt    DateTime @default\(now\)/,
  `  supplierId   String?
  productType  String   @default("physical") // physical | service
  packSize     Int?
  packUnit     String?
  baseUnit     String?
  createdAt    DateTime @default(now())`)

// 5. Add isActive to Warehouse
schema = schema.replace(
  /  isDefault   Boolean  @default\(false\)\n  createdAt   DateTime @default\(now\)\n\n  tenant      Tenant   @relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)\n  products    Product\[\]/,
  `  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products    Product[]`)

// 6. Append all new models at the end
const newModels = `
// ============ Custom Fields (no-code customization) ============
model CustomField {
  id          String   @id @default(cuid())
  tenantId    String
  module      String
  fieldKey    String
  label       String
  type        String   // text | number | date | select | textarea | checkbox | url | email | phone | formula | calculated
  options     String?
  defaultValue String?
  formula     String?
  formulaType String?
  sourceField String?
  isRequired  Boolean  @default(false)
  isFilterable Boolean  @default(false)
  showInTable  Boolean  @default(true)
  showInForm   Boolean  @default(true)
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  values      CustomFieldValue[]

  @@unique([tenantId, module, fieldKey])
  @@index([tenantId, module])
}

model CustomFieldValue {
  id          String   @id @default(cuid())
  tenantId    String
  customFieldId String
  entityType  String
  entityId    String
  value       String
  createdAt   DateTime @default(now())

  customField CustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)

  @@unique([customFieldId, entityId])
  @@index([tenantId, entityType, entityId])
}

model CustomTab {
  id          String   @id @default(cuid())
  tenantId    String
  module      String
  label       String
  content     String?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model StatusPipeline {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  orderStatuses String @default("[]")
  poStatuses    String @default("[]")
  customerStatuses String @default("[]")
  employeeStatuses String @default("[]")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model RecordNote {
  id          String   @id @default(cuid())
  tenantId    String
  entityType  String
  entityId    String
  authorId    String?
  authorName  String
  content     String
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, entityType, entityId])
}

model ModuleLabel {
  id          String   @id @default(cuid())
  tenantId    String
  moduleKey   String
  label       String
  description String?
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, moduleKey])
}

model FileAttachment {
  id          String   @id @default(cuid())
  tenantId    String
  entityType  String
  entityId    String
  fileName    String
  fileSize    Int
  mimeType    String
  base64Data  String
  uploadedBy  String?
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, entityType, entityId])
}

// ============ Customizable Invoice Template ============
model InvoiceTemplate {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  clinicName      String   @default("")
  clinicPhone     String   @default("")
  clinicAddress   String?  @default("")
  invoiceLabel    String   @default("INVOICE")
  showPatientIC   Boolean  @default(false)
  patientICLabel  String   @default("IC/Passport")
  showClinicalNotes Boolean @default(false)
  notesLabel      String   @default("Note")
  issueLabel      String   @default("Issue")
  findingsLabel   String   @default("Findings")
  diagnosisLabel  String   @default("Diagnosis")
  planLabel       String   @default("Plan")
  showItemNumber  Boolean  @default(true)
  itemColLabel    String   @default("Item")
  priceColLabel   String   @default("Price")
  unitColLabel    String   @default("Qty")
  amountColLabel  String   @default("Amount")
  totalLabel      String   @default("TOTAL TO PAY")
  currencySymbol  String   @default("RM")
  showPaymentQR   Boolean  @default(true)
  paymentInstructions String? @default("Scan to pay with DuitNow / TNG / Boost / all bank apps")
  footerText      String?  @default("Thank you for choosing us")
  primaryColor    String   @default("#263373")
  fontSize        String   @default("12px")
  patientCustomFields String? @default("[]")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

// ============ Service Encounter (generic, tenant-customizable) ============
model ClinicalEncounter {
  id              String   @id @default(cuid())
  tenantId        String
  orderId         String   @unique
  patientId       String
  doctorId        String?
  doctorName      String?
  data            String   @default("{}")
  advice          String?
  followUpDate    DateTime?
  followUpNotes   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order           SalesOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  patient         Customer   @relation(fields: [patientId], references: [id], onDelete: Cascade)
}

// ============ Encounter Template (tenant-customizable service form) ============
model EncounterTemplate {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  displayName     String   @default("Service Form")
  sections        String   @default("[]")
  itemTables      String   @default("[]")
  showAdvice      Boolean  @default(true)
  adviceLabel     String   @default("Advice / Notes")
  showFollowUp    Boolean  @default(true)
  followUpLabel   String   @default("Follow-up")
  showOnInvoice   Boolean  @default(true)
  requireEncounterBeforeInvoice Boolean @default(false)
  requiredSectionIds String?  @default("[]")
  defaultDepositAmount Float?
  defaultDepositLabel  String?  @default("Deposit")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

// ============ Document Templates (multi-type) ============
model DocumentTemplate {
  id          String   @id @default(cuid())
  tenantId    String
  docType     String   // invoice | quotation | receipt | purchase_order | delivery_note | statement | credit_note
  config      String   @default("{}")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, docType])
  @@index([tenantId])
}`

schema += newModels

fs.writeFileSync(schemaPath, schema)
console.log('✅ Schema updated with all customization models')
console.log('   - CustomField, CustomFieldValue, CustomTab, StatusPipeline, RecordNote, ModuleLabel, FileAttachment')
console.log('   - InvoiceTemplate, ClinicalEncounter, EncounterTemplate, DocumentTemplate')
console.log('   - Customer CRM fields (dateOfBirth, gender, idType, idNumber, nationality, occupation, lifecycleStage, leadSource, ownerId, tags)')
console.log('   - Product packSize, packUnit, baseUnit, productType')
console.log('   - SalesOrder encounter relation')
console.log('   - Warehouse isActive')
