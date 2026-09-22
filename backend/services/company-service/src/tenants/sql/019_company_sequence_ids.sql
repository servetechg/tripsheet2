-- Company-scoped auto IDs (idempotent; skips when ops tables are not provisioned yet).

DO $fleet$
BEGIN
  IF to_regclass('fleet."Load"') IS NOT NULL THEN
    UPDATE fleet."Load"
    SET "tripNo" = 'TRP-LEGACY-' || "id"
    WHERE "tripNo" IS NULL OR TRIM("tripNo") = '';

    UPDATE fleet."Load" AS l
    SET "tripNo" = 'TRP-DUP-' || SUBSTRING(l."id", 1, 12)
    FROM (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "companyId", "tripNo"
          ORDER BY "id"
        ) AS rn
      FROM fleet."Load"
      WHERE "tripNo" IS NOT NULL AND TRIM("tripNo") <> ''
    ) AS d
    WHERE l."id" = d."id" AND d.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS "Load_companyId_tripNo_key"
      ON fleet."Load" ("companyId", "tripNo");
  END IF;
END $fleet$;

DO $driver$
BEGIN
  IF to_regclass('driver."Driver"') IS NOT NULL THEN
    UPDATE driver."Driver"
    SET "employeeNumber" = 'EMP-LEGACY-' || SUBSTRING("id", 1, 10)
    WHERE "employeeNumber" IS NULL OR TRIM("employeeNumber") = '';

    UPDATE driver."Driver" AS d
    SET "employeeNumber" = 'EMP-DUP-' || SUBSTRING(d."id", 1, 10)
    FROM (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "companyId", "employeeNumber"
          ORDER BY "id"
        ) AS rn
      FROM driver."Driver"
      WHERE "employeeNumber" IS NOT NULL AND TRIM("employeeNumber") <> ''
    ) AS x
    WHERE d."id" = x."id" AND x.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS "Driver_companyId_employeeNumber_key"
      ON driver."Driver" ("companyId", "employeeNumber");
  END IF;
END $driver$;
