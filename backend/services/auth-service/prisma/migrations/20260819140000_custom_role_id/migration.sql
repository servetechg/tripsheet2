-- Phase 3 RBAC: pointer to tenant-owned custom role (company_local.CustomRole.id)
ALTER TABLE "User" ADD COLUMN "customRoleId" TEXT;
CREATE INDEX "User_customRoleId_idx" ON "User"("customRoleId");
