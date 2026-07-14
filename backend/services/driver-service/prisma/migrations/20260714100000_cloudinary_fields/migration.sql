-- AlterTable
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "cloudinaryPublicId" TEXT;
