-- Phase 1 RBAC: rename company_admin → company_owner, expand roles, catalog tables

ALTER TYPE "Role" RENAME VALUE 'company_admin' TO 'company_owner';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'general_manager';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'dispatcher';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'dispatcher_supervisor';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'fleet_manager';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'safety_manager';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'maintenance_coordinator';

CREATE TABLE "Permission" (
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "SystemRole" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "system" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "RolePermission" (
    "roleCode" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleCode","permissionCode")
);

CREATE INDEX "RolePermission_permissionCode_idx" ON "RolePermission"("permissionCode");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "SystemRole"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE CASCADE ON UPDATE CASCADE;
