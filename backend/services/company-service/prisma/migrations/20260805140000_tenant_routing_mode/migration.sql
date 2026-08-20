-- Phase 3: per-tenant runtime routing mode
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "routingMode" TEXT NOT NULL DEFAULT 'shared';
CREATE INDEX IF NOT EXISTS "TenantDatabase_routingMode_idx" ON "TenantDatabase"("routingMode");
