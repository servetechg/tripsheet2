-- Chapter 5 MDM Phase 5: Border crossings + Ports of Entry (CA–US)
-- Load cross-border + customs capability snapshots

CREATE TABLE IF NOT EXISTS company_local."BorderCrossing" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countries" TEXT NOT NULL DEFAULT 'CA-US',
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "BorderCrossing_companyId_idx"
  ON company_local."BorderCrossing"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "BorderCrossing_company_name_uidx"
  ON company_local."BorderCrossing"("companyId", "name");

CREATE TABLE IF NOT EXISTS company_local."PortOfEntry" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "borderCrossingId" TEXT,
  "borderCrossingName" TEXT NOT NULL DEFAULT '',
  "hours" TEXT NOT NULL DEFAULT '',
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "fastLane" BOOLEAN NOT NULL DEFAULT false,
  "ace" BOOLEAN NOT NULL DEFAULT false,
  "aci" BOOLEAN NOT NULL DEFAULT false,
  "paps" BOOLEAN NOT NULL DEFAULT false,
  "pars" BOOLEAN NOT NULL DEFAULT false,
  "restrictions" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "PortOfEntry_companyId_idx"
  ON company_local."PortOfEntry"("companyId");
CREATE INDEX IF NOT EXISTS "PortOfEntry_companyId_country_idx"
  ON company_local."PortOfEntry"("companyId", "country");
CREATE UNIQUE INDEX IF NOT EXISTS "PortOfEntry_company_code_uidx"
  ON company_local."PortOfEntry"("companyId", "code");

ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "crossBorder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "portOfEntryId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "portOfEntryCode" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "portOfEntryName" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customsProgram" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customsAce" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customsAci" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customsPaps" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customsPars" BOOLEAN NOT NULL DEFAULT false;
