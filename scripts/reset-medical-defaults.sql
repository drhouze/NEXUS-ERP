-- Reset medical-specific InvoiceTemplate defaults that leaked to non-medical tenants.
-- These fields defaulted to true / "DR HOUZE" in the original schema, so every tenant
-- got medical-style content on their invoice without opting in. Set them all off / blank.
-- Tenants who actually want clinical-note parsing can re-enable it from Settings → Invoice Design.

UPDATE "InvoiceTemplate"
SET
  "showClinicalNotes" = 0,
  "showPatientIC" = 0,
  "clinicName" = '';

-- Also neutralize EncounterTemplate.showAdvice / showFollowUp defaults so a fresh
-- tenant doesn't see empty "Advice" / "Follow-up" blocks rendered on the invoice
-- when they have not yet designed their service form.
UPDATE "EncounterTemplate"
SET
  "showAdvice" = 0,
  "showFollowUp" = 0
WHERE "sections" = '[]' AND "itemTables" = '[]';
