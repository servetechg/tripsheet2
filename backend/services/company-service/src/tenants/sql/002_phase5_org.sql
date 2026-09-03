-- Phase 5: Chapter 3 org tables (applied to each fq_tenant_* company_local)
CREATE TABLE IF NOT EXISTS company_local."CompanyDocument" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'general',
  "fileName" TEXT NOT NULL DEFAULT '',
  "fileUrl" TEXT NOT NULL DEFAULT '',
  "fileSize" INT,
  "uploadedBy" TEXT NOT NULL DEFAULT '',
  "expiresAt" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "CompanyDocument_companyId_idx" ON company_local."CompanyDocument"("companyId");

CREATE TABLE IF NOT EXISTS company_local."ApiCredential" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL DEFAULT '',
  "keyHash" TEXT NOT NULL,
  "scopes" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ApiCredential_companyId_idx" ON company_local."ApiCredential"("companyId");

CREATE TABLE IF NOT EXISTS company_local."SecurityPolicy" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE,
  "passwordMinLength" INT NOT NULL DEFAULT 8,
  "sessionDays" INT NOT NULL DEFAULT 7,
  "requireMfa" BOOLEAN NOT NULL DEFAULT false,
  "ipAllowlist" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_local."NotificationRule" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'sms',
  "target" TEXT NOT NULL DEFAULT 'admin',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "NotificationRule_companyId_idx" ON company_local."NotificationRule"("companyId");
