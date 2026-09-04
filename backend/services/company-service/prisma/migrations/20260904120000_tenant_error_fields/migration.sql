-- Structured tenant errors: user-facing message + code; lastError kept for internal logs.
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "lastErrorMessage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TenantDatabase" ADD COLUMN IF NOT EXISTS "lastErrorSeverity" TEXT NOT NULL DEFAULT '';

-- Clear known benign legacy messages on active tenants.
UPDATE "TenantDatabase"
SET
  "lastError" = '',
  "lastErrorCode" = '',
  "lastErrorMessage" = '',
  "lastErrorSeverity" = ''
WHERE
  "status" = 'active'
  AND "lastError" ILIKE '%no sibling prisma projects found%';
