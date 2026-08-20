-- Phase 4 RBAC: tenant password / lockout / session policy (company_local)
ALTER TABLE company_local."SecurityPolicy"
  ADD COLUMN IF NOT EXISTS "passwordComplexity" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lockoutThreshold" INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "lockoutMinutes" INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "idleTimeoutMinutes" INT NOT NULL DEFAULT 0;
