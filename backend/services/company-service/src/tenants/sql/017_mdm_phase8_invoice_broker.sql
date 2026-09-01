-- Phase 8 MDM: accounting Invoice broker link + Prisma timestamp parity

ALTER TABLE accounting."Invoice" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE accounting."Invoice" ADD COLUMN IF NOT EXISTS "brokerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE accounting."Invoice" ADD COLUMN IF NOT EXISTS "brokerId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON accounting."Invoice"("customerId");
CREATE INDEX IF NOT EXISTS "Invoice_brokerId_idx" ON accounting."Invoice"("brokerId");

ALTER TABLE accounting."Invoice"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::timestamp,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::timestamp;

ALTER TABLE accounting."LedgerAccount"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE accounting."LedgerAccount"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE accounting."Bill"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::timestamp,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::timestamp;

ALTER TABLE accounting."Payment"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::timestamp;

ALTER TABLE accounting."Settlement"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::timestamp,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::timestamp;
