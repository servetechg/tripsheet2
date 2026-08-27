-- Chapter 5 MDM Phase 1: asset status normalize + EquipmentType catalog

UPDATE fleet."Asset" SET "status" = 'available' WHERE "status" IN ('active', '');
UPDATE fleet."Asset" SET "status" = 'retired' WHERE "status" = 'inactive';

ALTER TABLE fleet."Asset"
  ALTER COLUMN "status" SET DEFAULT 'available';

ALTER TABLE fleet."Asset"
  ADD COLUMN IF NOT EXISTS "equipmentTypeCode" TEXT;

CREATE TABLE IF NOT EXISTS fleet."EquipmentType" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("companyId", "code")
);
CREATE INDEX IF NOT EXISTS "EquipmentType_companyId_idx"
  ON fleet."EquipmentType"("companyId");
