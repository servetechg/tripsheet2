-- Chapter 5 MDM Phase 2: Location + party masters (company_local)
-- Also extends fleet Load + accounting Invoice with optional FK snapshots

CREATE TABLE IF NOT EXISTS company_local."Location" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "line1" TEXT NOT NULL DEFAULT '',
  "line2" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "region" TEXT NOT NULL DEFAULT '',
  "postal" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT 'CA',
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "timeZone" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Location_companyId_idx" ON company_local."Location"("companyId");
CREATE INDEX IF NOT EXISTS "Location_companyId_status_idx" ON company_local."Location"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Location_normalizedKey_idx" ON company_local."Location"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."Broker" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mc" TEXT NOT NULL DEFAULT '',
  "dot" TEXT NOT NULL DEFAULT '',
  "scac" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "paymentTerms" TEXT NOT NULL DEFAULT '',
  "rateConfEmail" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "billingLocationId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Broker_companyId_idx" ON company_local."Broker"("companyId");
CREATE INDEX IF NOT EXISTS "Broker_companyId_status_idx" ON company_local."Broker"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Broker_normalizedKey_idx" ON company_local."Broker"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."Customer" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT NOT NULL DEFAULT '',
  "dba" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "paymentTerms" TEXT NOT NULL DEFAULT '',
  "creditLimit" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "taxExempt" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "billingLocationId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Customer_companyId_idx" ON company_local."Customer"("companyId");
CREATE INDEX IF NOT EXISTS "Customer_companyId_status_idx" ON company_local."Customer"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Customer_normalizedKey_idx" ON company_local."Customer"("companyId", "normalizedKey");

CREATE TABLE IF NOT EXISTS company_local."Consignee" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "contactName" TEXT NOT NULL DEFAULT '',
  "receivingHours" TEXT NOT NULL DEFAULT '',
  "dockNumber" TEXT NOT NULL DEFAULT '',
  "appointmentRequired" BOOLEAN NOT NULL DEFAULT false,
  "liftgateRequired" BOOLEAN NOT NULL DEFAULT false,
  "hazmatAccepted" BOOLEAN NOT NULL DEFAULT false,
  "instructions" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "locationId" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "normalizedKey" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "Consignee_companyId_idx" ON company_local."Consignee"("companyId");
CREATE INDEX IF NOT EXISTS "Consignee_companyId_status_idx" ON company_local."Consignee"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Consignee_normalizedKey_idx" ON company_local."Consignee"("companyId", "normalizedKey");

ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "brokerId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "originLocationId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "destinationLocationId" TEXT;
ALTER TABLE fleet."Load" ADD COLUMN IF NOT EXISTS "brokerName" TEXT;

ALTER TABLE accounting."Invoice" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
