-- Phase 1: Platform control plane (plans, subscriptions, tenant DB registry)

CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxDrivers" INTEGER NOT NULL DEFAULT 10,
    "features" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_code_key" ON "Plan"("code");

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "planId" TEXT;

UPDATE "Company"
SET "slug" = lower(regexp_replace(coalesce("shortName", "id"), '[^a-zA-Z0-9]+', '', 'g'))
WHERE "slug" IS NULL OR "slug" = '';

-- Disambiguate duplicate slugs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY "createdAt") AS rn
    FROM "Company"
  LOOP
    IF r.rn > 1 THEN
      UPDATE "Company" SET slug = r.slug || r.rn::text WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug");
CREATE INDEX IF NOT EXISTS "Company_status_idx" ON "Company"("status");
CREATE INDEX IF NOT EXISTS "Company_planId_idx" ON "Company"("planId");

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_companyId_key" ON "Subscription"("companyId");
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

CREATE TABLE IF NOT EXISTS "TenantDatabase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL DEFAULT 5432,
    "status" TEXT NOT NULL DEFAULT 'pending_provision',
    "connectionCiphertext" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT NOT NULL DEFAULT '',
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "provisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantDatabase_companyId_key" ON "TenantDatabase"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantDatabase_dbName_key" ON "TenantDatabase"("dbName");
CREATE INDEX IF NOT EXISTS "TenantDatabase_status_idx" ON "TenantDatabase"("status");

CREATE TABLE IF NOT EXISTS "TenantLifecycleEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT '',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TenantLifecycleEvent_companyId_idx" ON "TenantLifecycleEvent"("companyId");
CREATE INDEX IF NOT EXISTS "TenantLifecycleEvent_createdAt_idx" ON "TenantLifecycleEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "TenantLifecycleEvent_action_idx" ON "TenantLifecycleEvent"("action");

INSERT INTO "Plan" ("id", "code", "name", "description", "maxDrivers", "features", "active", "createdAt", "updatedAt")
VALUES
  ('plan_starter', 'starter', 'Starter', 'Up to 10 drivers; basic dispatch & fleet', 10,
   '{"driverOnboarding":true,"dispatch":true,"fleetMaintenance":true,"payroll":false,"ocr":false,"accounting":false,"reports":true,"apiAccess":false,"customs":false}'::jsonb,
   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_professional', 'professional', 'Professional', 'Unlimited drivers; OCR, payroll, accounting, reports', -1,
   '{"driverOnboarding":true,"dispatch":true,"fleetMaintenance":true,"payroll":true,"ocr":true,"accounting":true,"reports":true,"apiAccess":false,"customs":true}'::jsonb,
   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_enterprise', 'enterprise', 'Enterprise', 'Unlimited; API, multi-terminal, SSO-ready, white-label', -1,
   '{"driverOnboarding":true,"dispatch":true,"fleetMaintenance":true,"payroll":true,"ocr":true,"accounting":true,"reports":true,"apiAccess":true,"customs":true,"sso":true,"whiteLabel":true,"multiTerminal":true}'::jsonb,
   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "Company" c
SET "planId" = 'plan_starter'
WHERE c."planId" IS NULL;

INSERT INTO "Subscription" ("id", "companyId", "planId", "status", "startedAt", "createdAt", "updatedAt")
SELECT 'sub_' || c.id, c.id, coalesce(c."planId", 'plan_starter'), 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."companyId" = c.id);

INSERT INTO "TenantDatabase" ("id", "companyId", "dbName", "host", "port", "status", "connectionCiphertext", "schemaVersion", "createdAt", "updatedAt")
SELECT 'tdb_' || c.id, c.id, 'fq_tenant_' || c.slug, 'localhost', 5432, 'pending_provision', '', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "TenantDatabase" t WHERE t."companyId" = c.id);

INSERT INTO "TenantLifecycleEvent" ("id", "companyId", "action", "actorName", "detail", "createdAt")
SELECT 'tle_backfill_' || c.id, c.id, 'tenant.registry.backfill', 'system',
       jsonb_build_object('dbName', 'fq_tenant_' || c.slug, 'phase', 1),
       CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "TenantLifecycleEvent" e WHERE e."companyId" = c.id AND e.action = 'tenant.registry.backfill'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_planId_fkey') THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_companyId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_planId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantDatabase_companyId_fkey') THEN
    ALTER TABLE "TenantDatabase" ADD CONSTRAINT "TenantDatabase_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantLifecycleEvent_companyId_fkey') THEN
    ALTER TABLE "TenantLifecycleEvent" ADD CONSTRAINT "TenantLifecycleEvent_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
