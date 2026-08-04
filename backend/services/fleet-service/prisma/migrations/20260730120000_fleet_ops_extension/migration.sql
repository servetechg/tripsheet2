-- AlterTable
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "insuranceExpiry" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "plateExpiry" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "permitExpiry" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- AlterTable Load economics + stops
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "actualDelivery" TEXT;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "customerRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "carrierCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "fuelSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "accessorials" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "detentionHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "detentionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "miles" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "stops" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unitNo" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'repair',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performedAt" TEXT NOT NULL,
    "nextDueAt" TEXT,
    "odometer" DOUBLE PRECISION,
    "vendor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MaintenanceRecord_companyId_idx" ON "MaintenanceRecord"("companyId");
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_assetId_idx" ON "MaintenanceRecord"("assetId");

CREATE TABLE IF NOT EXISTS "DvirInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unitNo" TEXT NOT NULL DEFAULT '',
    "driverId" TEXT,
    "driverName" TEXT NOT NULL DEFAULT '',
    "inspectedAt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'satisfactory',
    "defects" JSONB NOT NULL DEFAULT '[]',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DvirInspection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DvirInspection_companyId_idx" ON "DvirInspection"("companyId");
CREATE INDEX IF NOT EXISTS "DvirInspection_assetId_idx" ON "DvirInspection"("assetId");
