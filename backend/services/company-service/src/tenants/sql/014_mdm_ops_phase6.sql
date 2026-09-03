-- Chapter 5 MDM Phase 6: thin ops / finance reference catalogs
-- No live fuel pricing. Optional FKs on fleet maintenance + assets.

CREATE TABLE IF NOT EXISTS company_local."MaintenanceVendor" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "locationId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "MaintenanceVendor_companyId_idx"
  ON company_local."MaintenanceVendor"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceVendor_company_norm_uidx"
  ON company_local."MaintenanceVendor"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."FuelStation" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT NOT NULL DEFAULT '',
  "locationId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "FuelStation_companyId_idx"
  ON company_local."FuelStation"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "FuelStation_company_norm_uidx"
  ON company_local."FuelStation"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."InsuranceProvider" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "InsuranceProvider_companyId_idx"
  ON company_local."InsuranceProvider"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceProvider_company_norm_uidx"
  ON company_local."InsuranceProvider"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."CostCenter" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "CostCenter_companyId_idx"
  ON company_local."CostCenter"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "CostCenter_company_code_uidx"
  ON company_local."CostCenter"("companyId", "code");

CREATE TABLE IF NOT EXISTS company_local."PayrollCategory" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "PayrollCategory_companyId_idx"
  ON company_local."PayrollCategory"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollCategory_company_code_uidx"
  ON company_local."PayrollCategory"("companyId", "code");

CREATE TABLE IF NOT EXISTS company_local."ReferenceData" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ReferenceData_companyId_kind_idx"
  ON company_local."ReferenceData"("companyId", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferenceData_company_kind_code_uidx"
  ON company_local."ReferenceData"("companyId", "kind", "code");

ALTER TABLE fleet."MaintenanceRecord" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE fleet."Asset" ADD COLUMN IF NOT EXISTS "insuranceProviderId" TEXT;
ALTER TABLE fleet."Asset" ADD COLUMN IF NOT EXISTS "insuranceProviderName" TEXT;
