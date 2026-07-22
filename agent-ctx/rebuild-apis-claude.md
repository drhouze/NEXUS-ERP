# rebuild-apis — Claude (Z.ai Code)

**Task ID:** `rebuild-apis`
**Task:** Recreate / extend 20 lost API route files for the multi-tenant ERP (custom fields, encounters, document templates, status pipelines, notes, attachments, order/customer/product pack-based billing, etc.).

**Status:** ✅ Completed — `bun run lint` clean (0 errors, 0 warnings); all 20 routes compile and respond (verified via `curl` — 401/405 as expected for unauthenticated/wrong-method probes).

---

## Schema changes (`prisma/schema.prisma`)

Two fields were missing from the brief's "the schema has been updated" claim — added them and ran `bun run db:push`:

- **`Product`** — added `packSize Int @default(1)`, `packUnit String @default("pack")`, `baseUnit String @default("unit")`, `productType String @default("standard")`.
- **`Warehouse`** — added `isActive Boolean @default(true)`.

All other models the brief mentioned (`CustomField`, `CustomFieldValue`, `CustomTab`, `StatusPipeline`, `RecordNote`, `ModuleLabel`, `FileAttachment`, `InvoiceTemplate`, `ClinicalEncounter`, `EncounterTemplate`, `DocumentTemplate`, customer CRM fields, SalesOrder.encounter) were already present in the schema.

---

## Files created / updated (20 total)

### Custom fields (3)
1. `src/app/api/erp/custom-fields/route.ts` — **NEW.** GET lists fields for a module, POST creates one or applies a preset. Exports `CUSTOM_FIELD_PRESETS` (medical_products / hotel_products / tailor_products), `FIELD_TYPES`, `FORMULA_TYPES`, `MODULES`, `slugify`. `applyPreset` is read from either `?applyPreset=` or the JSON body. Uniqueness enforced on `[tenantId, module, fieldKey]`. `buildFieldData` clears irrelevant config (options only for `select`, formula/sourceField/formulaType only for `formula`/`calculated`).
2. `src/app/api/erp/custom-fields/[id]/route.ts` — **NEW.** DELETE (cascade via DB), PATCH (updates label/sort/active/required/showInTable/showInForm/formulaType/sourceField/formula/type/options/defaultValue; re-validates type+formulaType; re-slugs fieldKey when label changes and no explicit fieldKey passed; clears irrelevant config when type changes).
3. `src/app/api/erp/custom-fields/values/route.ts` — **NEW.** GET returns either field defs (when `?module=`) or values (when `?entityType=&entityId=`). Values are returned in BOTH forms: `values: [{fieldKey, value, customField}]` (array — what the renderer reads) and `valuesMap: {fieldKey: value}` (object — task spec). POST accepts `{entityType, entityId, values}` OR the renderer's `{module, entityId, values}` shape (entityType falls back to module). Upserts each value on `(customFieldId, entityId)` compound key.

### Encounters (2)
4. `src/app/api/erp/encounter-template/route.ts` — **NEW.** GET auto-creates a blank template if missing + returns parsed sections/itemTables/requiredSectionIds + `ENCOUNTER_PRESETS` (medical/hotel/tailor/trading/blank, each with full section+column defs). PATCH accepts either `{applyPreset}` or any subset of the template fields.
5. `src/app/api/erp/clinical-encounter/[orderId]/route.ts` — **NEW.** GET loads order + encounter (parsed `data`) + template + patient custom values + product catalogue (with pack info + clinical custom-field values like route/strength/dosage_form — fetched in a single query to avoid N+1). PUT/POST upsert the encounter storing everything in one `data` JSON. When `syncToInvoice=true`, prescription rows (any item-table with a `product` column) are **added** to existing order items — pack-based billing: `packs = ceil(prescribedQty / packSize)`, `lineTotal = packs × pricePerPack`, `newTotal = existingItemsTotal + prescriptionTotal`. POST alias exists because the `EncounterDialog` component posts (not PUTs).

### Templates (2)
6. `src/app/api/erp/invoice-template/route.ts` — **NEW.** GET auto-creates if missing, returns `patientCustomFields` parsed. PATCH accepts all `InvoiceTemplate` string/bool fields; `patientCustomFields` stored as JSON string but accepts either array or pre-stringified.
7. `src/app/api/erp/document-templates/route.ts` — **NEW.** GET lists all (auto-creating any missing doc types) or returns a single template when `?docType=`. PATCH upserts `{docType, config}`. Exports `DOC_TYPES` (invoice/quotation/receipt/purchase_order/delivery_note/statement/credit_note) and `getDefaultConfig(docType)` with sensible per-type defaults (invoice→bank+QR, quotation→terms+signature, receipt→bank+sig, PO→terms+sig, delivery_note→sig, etc.).

### Pipelines & labels (2)
8. `src/app/api/erp/status-pipelines/route.ts` — **NEW.** GET auto-creates with defaults (orderStatuses=[pending,processing,shipped,delivered,cancelled], poStatuses, customerStatuses, employeeStatuses). PATCH updates any subset. Re-exports the defaults for backward-compat. **Helpers live in `src/lib/status-pipeline.ts`** (not in the route) so other routes can import them without importing a route handler.
9. `src/app/api/erp/module-labels/route.ts` — **NEW.** GET lists all + returns a `map` for quick lookup. PATCH upserts `{moduleKey, label, description?}` on `[tenantId, moduleKey]`.

### Notes & attachments (3)
10. `src/app/api/erp/notes/route.ts` — **NEW.** GET `?entityType=&entityId=` returns `{notes}` with each note's `author.name` populated (the `NotesPanel` reads either `n.authorName` or `n.author.name`). POST accepts `{entityType, entityId, content, authorName?}` — when `authorName` is omitted, the current user's name is used (the `NotesPanel` posts without `authorName`).
11. `src/app/api/erp/attachments/route.ts` — **NEW.** GET returns metadata only (no `base64Data`). POST accepts BOTH the task shape `{fileName, fileSize, mimeType, base64Data}` AND the `AttachmentsPanel` shape `{fileName, size, mimeType, data}` (falls back with `??`). DELETE supports `?id=` per the task spec.
12. `src/app/api/erp/attachments/[id]/route.ts` — **NEW.** GET returns the full row with `base64Data` exposed as both `attachment.data` and top-level `data` (the `AttachmentsPanel` download handler reads either). DELETE by path param (the `AttachmentsPanel` deletes via `/api/erp/attachments/${id}`).

### Orders (4)
13. `src/app/api/erp/orders/route.ts` — **UPDATED.** GET now includes `encounter: { select: { id, data, doctorName, updatedAt } }` and loads the tenant's `encounterTemplate` (parsed) so the order list/detail can show the encounter gate. POST now fetches the tenant's base `Currency` and stores its `code` on the order (falls back to USD).
14. `src/app/api/erp/orders/[id]/status/route.ts` — **UPDATED.** Validates status against the tenant's custom pipeline (via `getOrderStatuses`). Terminal status = last non-cancelled entry (via `getTerminalOrderStatus`) — replaces hardcoded `'delivered'`. **Server-side encounter gate:** when advancing to terminal AND `requireEncounterBeforeInvoice` is true, blocks unless an encounter exists with all `requiredSectionIds` filled. Stock-out + revenue recognition + COGS journal entry fire on terminal. Stock-return fires on cancellation only if the order was previously at terminal.
15. `src/app/api/erp/orders/[id]/payments/route.ts` — **UPDATED.** `method='deposit'` skips the balance check (allows overpayment). `method='refund'` stores a negative amount, decrements `paidAmount`, and creates an `expense` transaction (instead of income). Journal entry for refunds reverses the normal payment entry (Debit AR, Credit Cash). Regular payments still enforce the balance check.
16. `src/app/api/erp/orders/[id]/items/route.ts` — **NEW.** PATCH replaces all line items: validates every product belongs to the tenant, deletes existing items, creates new ones, recalculates total in a single transaction.

### Customers & products (4)
17. `src/app/api/erp/customers/route.ts` — **UPDATED.** GET adds `tags` (parsed from JSON), computed `age` (from `dateOfBirth` OR IC when `idType=IC`), and `lifecycleCounts` (group-by `lifecycleStage`). POST accepts all CRM fields (`dateOfBirth, gender, idType, idNumber, nationality, occupation, lifecycleStage, leadSource, ownerId, tags, lastContactAt`). Auto-extracts DOB from IC when `idType=IC` and no DOB was provided (via `parseIcToBirthDate`).
18. `src/app/api/erp/customers/[id]/route.ts` — **NEW** (didn't exist). GET (with orders), PATCH (all CRM fields + IC→DOB auto-extraction), DELETE.
19. `src/app/api/erp/products/route.ts` — **UPDATED.** POST accepts `packSize, packUnit, baseUnit, productType` (with sensible defaults: 1 / "pack" / "unit" / "standard").
20. `src/app/api/erp/products/[id]/route.ts` — **NEW** (didn't exist). GET, PATCH (all first-class Product columns incl. pack fields), DELETE. Comment in PATCH explicitly notes that `route / dosageForm / strength / packaging` are NOT Product columns — they're custom fields saved via `/api/erp/custom-fields/values`.

### Warehouses (1)
21. `src/app/api/erp/inventory/warehouses/[id]/route.ts` — **NEW.** PATCH edits `code/name/address` OR archives/unarchives (`isActive`). Prevents archiving the default warehouse. DELETE hard-deletes only when the warehouse has zero products AND zero stock movements; prevents deleting the default.

### Supporting lib (1)
22. `src/lib/status-pipeline.ts` — **NEW.** `getOrCreatePipeline`, `getOrderStatuses`, `getTerminalOrderStatus`, `getPoStatuses`, `getCustomerStatuses`, `getEmployeeStatuses` + the four default-pipeline constants. Extracted from the route so `orders/[id]/status` can import without importing a route handler (Next.js route files aren't meant to be imported as modules).

---

## Pattern notes for downstream agents

- **Auth/permissions:** every route calls `getCurrentUser()` first, returns 401 if null. Write routes additionally check `canWrite(user.role, module)` (modules: `inventory`, `orders`, `customers`, `purchasing`, `hr`, `finance`). OWNER bypasses the tenant filter and writes to `body.targetTenantId` (or their own).
- **Tenant filter:** `user.role === 'OWNER' ? {} : { tenantId: user.tenantId }`. OWNER sees all tenants; everyone else is scoped to their own.
- **Audit logging:** every mutating route calls `logAction({ ctx, action, entityType, entityId, entityName, summary, metadata })`. Failures are swallowed (audit must never break the request).
- **JSON-stringified columns:** `CustomField.options`, `Customer.tags`, `StatusPipeline.*Statuses`, `EncounterTemplate.sections/itemTables/requiredSectionIds`, `InvoiceTemplate.patientCustomFields`, `DocumentTemplate.config`, `ClinicalEncounter.data` are all stored as JSON strings. Routes parse them on read and re-stringify on write.
- **Auto-create-on-GET pattern:** `encounter-template`, `invoice-template`, `status-pipelines`, `document-templates?docType=` all auto-create a blank/default row on first GET so the frontend never has to handle a 404.
- **Encounter dialog contract:** the `EncounterDialog` component POSTs (not PUTs) to `/api/erp/clinical-encounter/[orderId]` with `{ sectionValues, tableRows, advice, followUpDate, followUpNotes, syncToInvoice }`. The route accepts both POST and PUT.
- **Custom-fields-renderer contract:** reads `d.values` as an array of `{fieldKey, value}` OR `{customField: {fieldKey}, value}`. The values route returns the array form. The renderer's `saveCustomFieldValues` posts `{module, entityId, values}` (no `entityType`) — the values route accepts `module` as a fallback for `entityType`.
- **Attachments-panel contract:** posts `{fileName, mimeType, size, data}` (not `fileSize`/`base64Data`). The attachments route accepts both shapes. Downloads hit `/api/erp/attachments/[id]` (not `?id=`) — that route returns `{data}` and `{attachment: {data}}` to satisfy both readers.
- **Notes-panel contract:** posts `{entityType, entityId, content}` (no `authorName`). The notes route derives `authorName` from the current user when not provided.

## Verification

- `bun run lint` → 0 errors, 0 warnings.
- `prisma db push` → schema synced (Product + Warehouse new columns applied).
- Hit every new/updated route via `curl` (unauthenticated) — all compile cleanly and return 401 (GET on protected routes) or 405 (wrong method on PATCH/DELETE-only routes). No 500s, no compile errors in `dev.log`.
