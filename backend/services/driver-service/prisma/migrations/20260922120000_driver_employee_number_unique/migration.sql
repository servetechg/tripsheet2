UPDATE "Driver"
SET "employeeNumber" = 'EMP-LEGACY-' || SUBSTRING("id", 1, 10)
WHERE "employeeNumber" IS NULL OR TRIM("employeeNumber") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "Driver_companyId_employeeNumber_key"
  ON "Driver"("companyId", "employeeNumber");
