-- Phase 3 RBAC: per-company custom roles (company_local)
CREATE TABLE IF NOT EXISTS company_local."CustomRole" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "baseRole" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("companyId", "code")
);
CREATE INDEX IF NOT EXISTS "CustomRole_companyId_idx" ON company_local."CustomRole"("companyId");

CREATE TABLE IF NOT EXISTS company_local."CustomRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL,
  PRIMARY KEY ("roleId", "permissionCode"),
  CONSTRAINT "CustomRolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES company_local."CustomRole"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomRolePermission_permissionCode_idx"
  ON company_local."CustomRolePermission"("permissionCode");
