-- CreateTable
CREATE TABLE IF NOT EXISTS "EquipmentType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "equipmentTypeCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentType_companyId_code_key" ON "EquipmentType"("companyId", "code");
CREATE INDEX IF NOT EXISTS "EquipmentType_companyId_idx" ON "EquipmentType"("companyId");
CREATE INDEX IF NOT EXISTS "Asset_status_idx" ON "Asset"("status");
