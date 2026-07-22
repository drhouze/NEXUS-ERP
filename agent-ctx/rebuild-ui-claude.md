# [rebuild-ui] — Claude (Z.ai Code)

**Task:** Rebuild 11 lost UI files (shell, settings, orders, customers, forms, inventory, plus 5 docs pages) for the multi-tenant ERP, integrating the rebuilt schema/lib/components/APIs.

**Status:** ✅ Completed — `bun run lint` clean (0 errors, 0 warnings); dev server log clean (no errors at `/` or `/login`).

**Files updated / created (11):**

### 1. `src/components/erp/shell.tsx` (UPDATE)
- Imports `setBaseCurrency` from `./lib`.
- New `useEffect` fetches `/api/erp/currencies` on mount, finds the `isBase` currency, calls `setBaseCurrency(code, symbol)` and bumps a `currencySymbolVersion` counter (used as a `key` on the main content wrapper to force every descendant to re-render with the new symbol).
- Skipped for `OWNER` (no tenant) — defaults remain ($/USD).
- Module-label override fetch (`/api/erp/module-labels`) preserved with a `resolveLabel(item)` helper that resolves both label and description through the override map (used in the sidebar nav + page header).

### 2. `src/components/erp/settings.tsx` (major rewrite)
- Replaced the horizontal `Tabs` with a 2-column sidebar layout:
  - Left sidebar (`256px`, `lg:sticky top-20`) with grouped navigation; mobile collapses to a horizontal scroll strip.
  - Right panel: section title header (icon + title + subtitle) + active section content.
  - 5 groups: Account, Finance, Customization, Security & Access, Data & Backup.
- Added 4 new tabs:
  - **Custom Fields / Tabs / Statuses** (`CustomFieldsManager`): module picker, preset buttons (medical / hotel / tailor product presets — only shown for `product` module), per-row pencil edit panel, native `<select>` for type/formula-type/options dropdowns.
  - **Invoice Design** (`InvoiceTemplateTab`): full invoice template editor with header branding, patient info block + multi-picker for custom fields (toggling calls `update()` on BOTH tick and untick paths), line item column labels, "Order Notes on Invoice" card (neutral wording), DuitNow QR block, and two pointer cards pointing to the Service Form Designer and Document Templates tabs.
  - **Document Templates** (`DocumentTemplateDesignerTab`): wraps the existing `DocumentTemplateDesigner` in a Card.
  - **Service Form Designer** (`EncounterFormDesignerTab`): wraps `EncounterFormDesigner` in a Card.
- All pre-existing tabs preserved (Subscription, Numbering, Currencies, DuitNow, Security, API Keys, Webhooks, SSO, Retention, Email Log, Backup) — re-skinned to use `primary`-based colors instead of indigo, and `formatCurrency` instead of hardcoded `$`.

### 3. `src/components/erp/orders.tsx` (major rewrite)
- Imports `Stethoscope`, `RotateCcw`, `MoreHorizontal` from lucide-react and `EditDialog`, `EncounterDialog` from the rebuilt dialog components.
- `OrdersData` interface extended with `encounterTemplate` (sections, itemTables, requiredSectionIds, requireEncounterBeforeInvoice, defaultDepositAmount/Label).
- New state: `customStatuses` (fetched from `/api/erp/status-pipelines` on mount), `editingOrder`, `encounterOrder`.
- New helpers:
  - `hasServiceFormConfigured()` → true when template has sections or item tables.
  - `getTerminalStatus()` → last non-cancelled entry in `customStatuses`.
  - `checkEncounterGate(order)` → `{ok, reason?}` based on encounter existence + required sections.
  - `refundSurplus(order)` → opens payment dialog pre-filled with the surplus amount.
- `changeStatus()` now gates advancement to terminal status with a client-side encounter check (server enforces the same).
- Per-row action buttons:
  - **Stethoscope** — only if `hasServiceFormConfigured()`; pulses amber when the encounter gate is blocking.
  - **Payment** — when balance > 0.01.
  - **Refund** — when surplus > 0.01.
  - **Invoice (FileText)** — gated by encounter check; amber when locked.
  - **MoreVertical dropdown (⋮)** — links to `/docs/quotation/[id]`, `/docs/receipt/[id]`, `/docs/delivery-note/[id]`, plus Edit Order + Duplicate + Open Service Form.
  - **Status dropdown** — shows "Completed" badge when terminal; hides "Advance" when empty/terminal; surfaces the encounter gate reason in the menu.
- Payment dialog upgrades:
  - Adds `deposit` (skips balance check) and `refund` (negative amount, expense transaction) to method dropdown.
  - Quick amount buttons: Full Balance, 50%, Deposit (uses `defaultDepositAmount` from template), Refund Surplus, Custom.
  - 3-state balance display: Balance Due (rose) / Surplus (amber) / Settled (emerald).
  - Payment history color-codes deposits in indigo, refunds in red.
- `EditDialog` (with status field) wired to PATCH `/api/erp/orders/[id]/status`.
- `EncounterDialog` wired with `onSaved` → `loadData()`.

### 4. `src/components/erp/customers.tsx` (major rewrite)
- Imports `LifecycleBadge` from `./shared`, `EditDialog` from `./edit-dialog`, `CustomerForm` from `./forms`.
- New `lifecycleFilter` state + dropdown (next to the search input).
- Customer cards now show: `LifecycleBadge`, age/gender chips (Cake/Mars icons), ID chip (IdCard icon), nationality chip (Flag icon — only when non-Malaysian), tags chips (Tag icon, max 2), lead source under order count.
- Customer detail panel adds: **Personal Info section** (age, DOB, gender, ID, nationality, occupation), **Tags section**, and a lead-source row.
- Edit button in the panel header opens `EditDialog` with all CRM fields (name, company, email, phone, idType, idNumber, dateOfBirth, gender, nationality, occupation, lifecycleStage, leadSource, status, tags).
- `EditDialog` is configured with `module="customer"`, `entityType="customer"`, `showNotes`, `showAttachments` so the rebuilt EditDialog renders `CustomFieldsRenderer` + Notes + Attachments panels.
- Tags are converted to/from comma-separated strings in the form ↔ API boundary.

### 5. `src/components/erp/forms.tsx` (major rewrite)
- Imports `SearchableSelect` from `./searchable-select`, `CustomFieldsRenderer, saveCustomFieldValues` from `./custom-fields-renderer`, `Pill` from lucide-react.
- Uses `getBaseCurrencySymbol()` from `./lib` instead of hardcoded `$`.

**ProductForm:**
- Form state gains `packSize`, `packUnit`, `baseUnit`, `productType`.
- Adds `Medication` to category options.
- Price label = `Price (${sym} per pack)`, Cost label = `Cost (${sym} per pack)`.
- Stock Qty / Reorder Level / Warehouse fields are hidden when `productType === 'service'`; an amber note explains service items don't track stock.
- New teal-bordered Pack Configuration card with packSize (number), packUnit (native `<select>`), baseUnit (native `<select>`).
- `CustomFieldsRenderer` (module=`product`) embedded below the pack card to capture route/dosageForm/strength/etc.
- POST body includes `packSize, packUnit, baseUnit, productType`; after creation, custom field values are saved via `saveCustomFieldValues`.

**CustomerForm (CRM upgrade):**
- Form state expanded to all CRM fields: name/email/phone/company/status + dateOfBirth/gender/idType/idNumber/nationality/occupation + lifecycleStage/leadSource/ownerId/tags.
- 3 sections: Contact, Personal Info, CRM Lifecycle.
- `liveAge` computed from `dateOfBirth` (read-only auto-calculated input).
- POST sends all CRM fields; tags converted to array.
- After creation, custom field values are saved via `saveCustomFieldValues`.

**SalesOrderForm:**
- Customer `<Select>` replaced with `SearchableSelect` (search by name/email/phone/company).
- Product `<Select>` replaced with `SearchableSelect` (search by name/SK/category; description = `SKU · ${price} · ${stockQty} in stock`).
- Total + line totals use `getBaseCurrencySymbol()`.

**PurchaseOrderForm:**
- Supplier `<Select>` replaced with `SearchableSelect` (search by name/contact/email/country).
- Product `<Select>` replaced with `SearchableSelect` (description = `SKU · cost ${cost} · ${stockQty} in stock`).

### 6. `src/components/erp/inventory.tsx` (UPDATE)
- Imports `EditDialog, EditField` from `./edit-dialog`, `Pencil` icon.
- New module-level constants `PRODUCT_CATEGORIES`, `PACK_UNITS`, `BASE_UNITS` (with empty-string entries filtered out for selects).
- `ProductsTab` gains `editing` state and an `editFields` config that includes:
  - All first-class Product columns (name, sku, category, productType, price, cost).
  - `packSize, packUnit, baseUnit` fields with `showIf: d => d.productType !== 'service'` (service items skip pack config).
  - `stockQty, reorderLevel` fields with the same `showIf` (service items skip stock).
  - **No** `route`, `dosageForm`, `strength`, `packaging` — these are handled as custom fields by the `CustomFieldsRenderer` embedded in the `EditDialog` (`module="product"`).
- Each product row gets a pencil icon button next to the Reorder button that opens the `EditDialog`.
- The dialog also exposes `showNotes` and `showAttachments`.

### 7. `src/app/docs/invoice/[id]/page.tsx` (UPDATE)
- Imports `CustomizableInvoice` from `@/components/erp/customizable-invoice`, `canWrite` from `@/lib/permissions`, `computeAge, computeAgeFromIc, parseIcToBirthDate` from `@/lib/calculated-fields`.
- Order query includes `encounter: true` (1:1) and `tenant: true`.
- Loads the tenant's `EncounterTemplate` and parses `sections`, `itemTables`, `requiredSectionIds` from JSON.
- **Server-side encounter gate**: if `requireEncounterBeforeInvoice` is true and the order has no encounter (or required sections are missing), returns a full-screen "Invoice Locked" view with a Lock icon and a Back to Orders button instead of the invoice.
- Loads `InvoiceTemplate` (auto-create if missing).
- Loads `CustomField` defs for the customer module and `CustomFieldValue`s for the customer; filters defs to those selected in `patientCustomFields`.
- Loads `CustomFieldValue`s for all line-item products (grouped by entityId) so the invoice can show route/strength/etc. alongside each line.
- Builds a `productMap` keyed by product id with `packSize, packUnit, baseUnit, unit (alias), custom` fields.
- Computes `patientAge` from `dateOfBirth` (or IC number when `idType === 'IC'`).
- Assembles `patientInfo = { idNumber, age, dateOfBirth, gender, nationality, occupation }`.
- Parses the encounter's `data` JSON into `{ sectionValues, tableRows, advice, followUpDate, followUpNotes }`.
- Loads order `Note`s (wrapped in try/catch in case the table doesn't exist).
- Renders `<CustomizableInvoice>` with all props.

### 8-10. `src/app/docs/{quotation,receipt,delivery-note}/[id]/page.tsx` (NEW)
- Each follows the same pattern: load order + customer + items + payments + tenant, load (or auto-create) the matching `DocumentTemplate` row, parse its config, and render `<GenericDocument docType="..." template={...} tenant={...} order={...} payments={...} showBack />`.
- Imports `getDefaultConfig` from `@/app/api/erp/document-templates/route` to seed the auto-created template.

### 11. `src/app/docs/po/[id]/page.tsx` (UPDATE)
- Now imports `GenericDocument` (instead of `PODocument` from `documents.tsx`) and `getDefaultConfig`.
- Loads the `purchase_order` document template (auto-create if missing), parses config, renders `<GenericDocument docType="purchase_order" template={...} tenant={...} po={po} showBack />`.

---

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- Dev server log clean — no compile errors, no runtime errors at `/` and `/login`.

## Notes for downstream agents
- The `formatCurrency` family in `./lib` reads the symbol from a module-level singleton set by `setBaseCurrency`. Because that singleton lives outside React state, after the Shell mounts and calls `setBaseCurrency`, we bump a `currencySymbolVersion` counter used as a `key` on the main content wrapper to force every descendant to re-render with the new symbol. Components mounted before the fetch resolves will render with the default `$` and then re-render with the correct symbol once the fetch lands.
- The orders UI's encounter gate is **client-side only** for UX. The server (`/api/erp/orders/[id]/status`) re-validates the same gate (worklog §`[rebuild-apis]`) — even if a user bypasses the client check, the server returns a 400.
- The invoice page (`/docs/invoice/[id]`) does its own server-side gate (worklog §`[rebuild-components]` describes the renderer; this page wires the gate). When the gate blocks, it returns a "Invoice Locked" amber screen rather than the invoice — no client-side escape hatch.
- For doc routes other than invoice, no gate is applied (quotations, receipts, delivery notes are always viewable).
- The `productMap` in the invoice page includes the `custom` sub-map of product custom field values so a future invoice template variant could surface route/strength/etc. on each line item without another query.
- The CustomerForm and ProductForm both call `saveCustomFieldValues` AFTER the create POST returns. If those custom field calls fail, the entity itself is still created (the failure is swallowed — the renderer uses `try/catch` and returns `false`).
- For EditDialog-driven entities (customer, product), `saveCustomFieldValues` is called inside EditDialog's submit handler (already wired by `edit-dialog.tsx`) — no extra work needed in the parent.
