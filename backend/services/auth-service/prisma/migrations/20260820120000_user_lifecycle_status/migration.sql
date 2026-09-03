-- Chapter 4 Phase 1: account lifecycle status (soft archive; never hard-delete)
CREATE TYPE "UserStatus" AS ENUM (
  'pending',
  'invited',
  'active',
  'inactive',
  'suspended',
  'locked',
  'archived'
);

ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_companyId_status_idx" ON "User"("companyId", "status");
CREATE INDEX "User_status_idx" ON "User"("status");
