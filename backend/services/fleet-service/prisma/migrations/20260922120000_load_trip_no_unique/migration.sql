-- Backfill missing trip numbers, then enforce uniqueness per company.
UPDATE "Load"
SET "tripNo" = 'TRP-LEGACY-' || "id"
WHERE "tripNo" IS NULL OR TRIM("tripNo") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "Load_companyId_tripNo_key"
  ON "Load"("companyId", "tripNo");
