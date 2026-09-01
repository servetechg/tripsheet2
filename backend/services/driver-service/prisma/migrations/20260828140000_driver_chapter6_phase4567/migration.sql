-- Chapter 6 Phases 4-7
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT NOT NULL DEFAULT 'available';
CREATE INDEX IF NOT EXISTS "Driver_availabilityStatus_idx" ON "Driver"("availabilityStatus");

CREATE TABLE IF NOT EXISTS "DriverEquipmentAssignment" (
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
CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_driverId_idx" ON "DriverEquipmentAssignment"("driverId");
CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_companyId_idx" ON "DriverEquipmentAssignment"("companyId");
CREATE INDEX IF NOT EXISTS "DriverEquipmentAssignment_assetId_idx" ON "DriverEquipmentAssignment"("assetId");

CREATE TABLE IF NOT EXISTS "DriverSafetyEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preventable" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverSafetyEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DriverSafetyEvent_driverId_idx" ON "DriverSafetyEvent"("driverId");

CREATE TABLE IF NOT EXISTS "DriverTrainingRecord" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverTrainingRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DriverTrainingRecord_driverId_idx" ON "DriverTrainingRecord"("driverId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEquipmentAssignment_driverId_fkey') THEN
    ALTER TABLE "DriverEquipmentAssignment" ADD CONSTRAINT "DriverEquipmentAssignment_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverSafetyEvent_driverId_fkey') THEN
    ALTER TABLE "DriverSafetyEvent" ADD CONSTRAINT "DriverSafetyEvent_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverTrainingRecord_driverId_fkey') THEN
    ALTER TABLE "DriverTrainingRecord" ADD CONSTRAINT "DriverTrainingRecord_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
