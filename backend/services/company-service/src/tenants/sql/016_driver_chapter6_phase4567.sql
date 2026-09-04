-- Chapter 6 Driver Management — Phases 4–7

ALTER TABLE driver."Driver" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT NOT NULL DEFAULT 'available';
CREATE INDEX IF NOT EXISTS "Driver_availabilityStatus_idx" ON driver."Driver"("availabilityStatus");

CREATE TABLE IF NOT EXISTS driver."DriverEquipmentAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'primary',
  "unitNo" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "assignedByUserId" TEXT,
  "notes" TEXT,
  CONSTRAINT "DriverEquipmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_driverId_idx" ON driver."DriverEquipmentAssignment"("driverId");
CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_companyId_idx" ON driver."DriverEquipmentAssignment"("companyId");
CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_assetId_idx" ON driver."DriverEquipmentAssignment"("assetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEquipmentAssignment_driverId_fkey') THEN
    ALTER TABLE driver."DriverEquipmentAssignment"
      ADD CONSTRAINT "DriverEquipmentAssignment_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES driver."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS driver."DriverSafetyEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "preventable" BOOLEAN,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverSafetyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverSafetyEvent_driverId_idx" ON driver."DriverSafetyEvent"("driverId");
CREATE INDEX IF NOT EXISTS "DriverSafetyEvent_companyId_idx" ON driver."DriverSafetyEvent"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverSafetyEvent_driverId_fkey') THEN
    ALTER TABLE driver."DriverSafetyEvent"
      ADD CONSTRAINT "DriverSafetyEvent_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES driver."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS driver."DriverTrainingRecord" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "courseName" TEXT,
  "completedAt" TEXT NOT NULL,
  "expiryDate" TEXT,
  "instructor" TEXT,
  "certificateDocumentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverTrainingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverTrainingRecord_driverId_idx" ON driver."DriverTrainingRecord"("driverId");
CREATE INDEX IF NOT EXISTS "DriverTrainingRecord_companyId_idx" ON driver."DriverTrainingRecord"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverTrainingRecord_driverId_fkey') THEN
    ALTER TABLE driver."DriverTrainingRecord"
      ADD CONSTRAINT "DriverTrainingRecord_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES driver."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
