-- Phase 4: ETL / cutover tracking on tenant registry
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "etlStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "etlReport" JSONB;
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "etlVerifiedAt" TIMESTAMP(3);
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "writeFreeze" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "cutoverAt" TIMESTAMP(3);
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TenantDatabase_etlStatus_idx" ON "TenantDatabase"("etlStatus");
