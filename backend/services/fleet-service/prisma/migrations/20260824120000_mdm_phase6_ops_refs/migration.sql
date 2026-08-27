ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "insuranceProviderId" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "insuranceProviderName" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
