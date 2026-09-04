-- FleetQuix tenant database bootstrap (Phase 2)
-- Applied to each fq_tenant_{slug} after CREATE DATABASE
-- Schemas mirror microservice domains for Phase 3 routing

CREATE SCHEMA IF NOT EXISTS company_local;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS driver;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS manifest;
CREATE SCHEMA IF NOT EXISTS tripsheet;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS notification;

-- ── company_local (settings, branches, branding stubs) ─────────────
CREATE TABLE IF NOT EXISTS company_local."Branch" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "managerName" TEXT NOT NULL DEFAULT '',
  "timeZone" TEXT NOT NULL DEFAULT 'America/Edmonton',
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Branch_companyId_idx" ON company_local."Branch"("companyId");

CREATE TABLE IF NOT EXISTS company_local."Department" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Department_companyId_idx" ON company_local."Department"("companyId");

CREATE TABLE IF NOT EXISTS company_local."CompanySettings" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE,
  "general" JSONB NOT NULL DEFAULT '{}',
  "dispatch" JSONB NOT NULL DEFAULT '{}',
  "driver" JSONB NOT NULL DEFAULT '{}',
  "accounting" JSONB NOT NULL DEFAULT '{}',
  "maintenance" JSONB NOT NULL DEFAULT '{}',
  "compliance" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_local."CompanyBranding" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE,
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "primaryColor" TEXT NOT NULL DEFAULT '#2563EB',
  "secondaryColor" TEXT NOT NULL DEFAULT '#0F172A',
  "accentColor" TEXT NOT NULL DEFAULT '#D4A017',
  "invoiceHeader" TEXT NOT NULL DEFAULT '',
  "invoiceFooter" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── auth (tenant-scoped user mirror for Phase 3) ───────────────────
CREATE TABLE IF NOT EXISTS auth."User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "companyId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── driver ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver."Driver" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "dob" TEXT,
  "licenseNo" TEXT,
  "citizenship" TEXT,
  "address" TEXT,
  "emergencyName" TEXT,
  "emergencyPhone" TEXT,
  "fastCard" TEXT,
  "notes" TEXT,
  "sin" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "branchId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("companyId", "email")
);
CREATE INDEX IF NOT EXISTS "Driver_companyId_idx" ON driver."Driver"("companyId");

CREATE TABLE IF NOT EXISTS driver."DriverDocument" (
  "id" TEXT PRIMARY KEY,
  "driverId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INT,
  "fileType" TEXT,
  "fileUrl" TEXT,
  "cloudinaryPublicId" TEXT,
  "fileData" TEXT,
  "uploadedAt" TEXT NOT NULL DEFAULT '',
  "expiryDate" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "DriverDocument_driverId_idx" ON driver."DriverDocument"("driverId");
CREATE INDEX IF NOT EXISTS "DriverDocument_companyId_idx" ON driver."DriverDocument"("companyId");

CREATE TABLE IF NOT EXISTS driver."Contract" (
  "id" TEXT PRIMARY KEY,
  "driverId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driverName" TEXT,
  "companyName" TEXT,
  "startDate" TEXT,
  "payType" TEXT,
  "payRate" TEXT,
  "payUnit" TEXT,
  "teamRate" TEXT,
  "detentionRate" TEXT,
  "waitRate" TEXT,
  "fuelSurcharge" TEXT,
  "vacationPct" TEXT,
  "trialDays" TEXT,
  "noticeDays" TEXT,
  "benefits" TEXT,
  "signedByDriver" BOOLEAN NOT NULL DEFAULT false,
  "signedByAdmin" BOOLEAN NOT NULL DEFAULT false,
  "signedAt" TEXT,
  "driverSignature" TEXT,
  "adminSignature" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver."Invite" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "companyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "kind" TEXT NOT NULL DEFAULT 'driver',
  "role" TEXT NOT NULL DEFAULT 'driver',
  "email" TEXT,
  "name" TEXT,
  "driverId" TEXT,
  "expiresAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT '',
  "completedAt" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Invite_companyId_idx" ON driver."Invite"("companyId");

-- ── fleet ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet."Asset" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "unitNo" TEXT NOT NULL,
  "year" TEXT,
  "make" TEXT,
  "model" TEXT,
  "vin" TEXT,
  "plate" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  "insuranceExpiry" TEXT,
  "plateExpiry" TEXT,
  "permitExpiry" TEXT,
  "notes" TEXT,
  "equipmentTypeCode" TEXT,
  "branchId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("companyId", "unitNo")
);
CREATE INDEX IF NOT EXISTS "Asset_companyId_idx" ON fleet."Asset"("companyId");

CREATE TABLE IF NOT EXISTS fleet."Load" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT,
  "truckId" TEXT,
  "trailerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "pickupTime" TEXT,
  "eta" TEXT,
  "actualDelivery" TEXT,
  "tripNo" TEXT,
  "notes" TEXT,
  "truckNo" TEXT,
  "trailerNo" TEXT,
  "customerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carrierCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fuelSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accessorials" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "detentionHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "detentionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stops" JSONB NOT NULL DEFAULT '[]',
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "heading" TEXT,
  "lastUpdate" TEXT,
  "branchId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Load_companyId_idx" ON fleet."Load"("companyId");
CREATE INDEX IF NOT EXISTS "Load_status_idx" ON fleet."Load"("status");

CREATE TABLE IF NOT EXISTS fleet."MaintenanceRecord" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "unitNo" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'repair',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "performedAt" TEXT NOT NULL,
  "nextDueAt" TEXT,
  "odometer" DOUBLE PRECISION,
  "vendor" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet."DvirInspection" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "unitNo" TEXT NOT NULL DEFAULT '',
  "driverId" TEXT,
  "driverName" TEXT NOT NULL DEFAULT '',
  "inspectedAt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'satisfactory',
  "defects" JSONB NOT NULL DEFAULT '[]',
  "remarks" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── manifest ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifest."CarrierProfile" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE,
  "cbsaCarrierCode" TEXT NOT NULL DEFAULT '',
  "scacCode" TEXT NOT NULL DEFAULT '',
  "dotNumber" TEXT NOT NULL DEFAULT '',
  "csnNumber" TEXT NOT NULL DEFAULT '',
  "fastLane" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manifest."Manifest" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Manifest_companyId_idx" ON manifest."Manifest"("companyId");

-- ── tripsheet ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tripsheet."TripSheet" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "header" JSONB NOT NULL DEFAULT '{}',
  "trips" JSONB NOT NULL DEFAULT '[]',
  "expenses" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "TripSheet_companyId_idx" ON tripsheet."TripSheet"("companyId");

-- ── accounting ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounting."Settlement" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "driverName" TEXT NOT NULL DEFAULT '',
  "periodStart" TEXT NOT NULL,
  "periodEnd" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting."LedgerAccount" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE ("companyId", "code")
);

CREATE TABLE IF NOT EXISTS accounting."Invoice" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "loadId" TEXT,
  "tripNo" TEXT NOT NULL DEFAULT '',
  "issueDate" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "lines" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting."Bill" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "vendorName" TEXT NOT NULL,
  "issueDate" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting."Payment" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "partyName" TEXT NOT NULL,
  "invoiceId" TEXT,
  "billId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TEXT NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'ach',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── notification ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification."NotificationLog" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT,
  "to" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "meta" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification."Message" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "threadType" TEXT NOT NULL DEFAULT 'driver',
  "fromUserId" TEXT,
  "fromName" TEXT NOT NULL DEFAULT '',
  "toUserId" TEXT,
  "toName" TEXT NOT NULL DEFAULT '',
  "loadId" TEXT,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification."Comment" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT NOT NULL DEFAULT '',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_local."TenantMeta" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL DEFAULT ''
);

INSERT INTO company_local."TenantMeta" ("key", "value")
VALUES ('schemaVersion', '2'), ('provisionedAt', NOW()::text)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
