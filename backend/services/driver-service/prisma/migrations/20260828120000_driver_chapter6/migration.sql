-- AlterTable: Chapter 6 Driver lifecycle, employment, qualifications
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "driverType" TEXT NOT NULL DEFAULT 'company';
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "employeeNumber" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "employmentStatus" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "hireDate" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "probationEndDate" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "seniorityDate" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "managerUserId" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dispatcherUserId" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "preferredName" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "ownerOperatorProfile" JSONB;

UPDATE "Driver" SET "lifecycleStatus" = 'suspended' WHERE "active" = false AND "lifecycleStatus" = 'active';

CREATE INDEX IF NOT EXISTS "Driver_lifecycleStatus_idx" ON "Driver"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "Driver_driverType_idx" ON "Driver"("driverType");

CREATE TABLE IF NOT EXISTS "DriverQualification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "class" TEXT,
    "endorsements" JSONB,
    "issueDate" TEXT,
    "expiryDate" TEXT,
    "issuingAuthority" TEXT,
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "ocrData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverQualification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverQualification_driverId_idx" ON "DriverQualification"("driverId");
CREATE INDEX IF NOT EXISTS "DriverQualification_companyId_idx" ON "DriverQualification"("companyId");
CREATE INDEX IF NOT EXISTS "DriverQualification_type_idx" ON "DriverQualification"("type");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverQualification_driverId_fkey') THEN
    ALTER TABLE "DriverQualification" ADD CONSTRAINT "DriverQualification_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
