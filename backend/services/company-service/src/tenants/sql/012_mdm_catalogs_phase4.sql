-- Chapter 5 MDM Phase 4: Commodity + Warehouse catalogs
-- Load.commodityId/commodityName for optional FK + display snapshot

CREATE TABLE IF NOT EXISTS company_local."Commodity" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nmfc" TEXT NOT NULL DEFAULT '',
  "hazmat" BOOLEAN NOT NULL DEFAULT false,
  "tempMin" DOUBLE PRECISION,
  "tempMax" DOUBLE PRECISION,
  "weightLimit" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Commodity_companyId_idx" ON company_local."Commodity"("companyId");
CREATE INDEX IF NOT EXISTS "Commodity_companyId_status_idx" ON company_local."Commodity"("companyId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Commodity_company_norm_uidx"
  ON company_local."Commodity"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."Warehouse" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationId" TEXT,
  "hours" TEXT NOT NULL DEFAULT '',
  "docks" TEXT NOT NULL DEFAULT '',
  "appointmentRules" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Warehouse_companyId_idx" ON company_local."Warehouse"("companyId");
CREATE INDEX IF NOT EXISTS "Warehouse_companyId_status_idx" ON company_local."Warehouse"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Warehouse_locationId_idx" ON company_local."Warehouse"("locationId");

ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "commodityId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "commodityName" TEXT;
