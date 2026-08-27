-- Chapter 5 MDM Phase 3: subcontract Carrier master (≠ manifest CarrierProfile)
-- Load.carrierId for optional subcontracting; soft-archive on merge loser

CREATE TABLE IF NOT EXISTS company_local."Carrier" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mc" TEXT NOT NULL DEFAULT '',
  "dot" TEXT NOT NULL DEFAULT '',
  "scac" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "insuranceExpiry" TEXT NOT NULL DEFAULT '',
  "safetyRating" TEXT NOT NULL DEFAULT '',
  "equipmentNotes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Carrier_companyId_idx" ON company_local."Carrier"("companyId");
CREATE INDEX IF NOT EXISTS "Carrier_companyId_status_idx" ON company_local."Carrier"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Carrier_normalizedKey_idx" ON company_local."Carrier"("companyId", "normalizedKey");

ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "carrierId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "carrierName" TEXT;
