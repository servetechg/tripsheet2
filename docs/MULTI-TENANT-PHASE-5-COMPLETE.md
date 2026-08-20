# Phase 5 complete — Chapter 3 product modules

**Date:** 2026-08-17  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### 1. Company profile + settings packs
- Platform profile PATCH via existing companies API
- Tenant `CompanySettings` packs: GET/PATCH `/api/companies/:id/settings`
- Company Admin → **Company** tab → Profile / Settings

### 2. Branches & departments
- CRUD/list for `company_local.Branch` (soft-deactivate) and `Department`
- `branchId` added to driver + fleet Prisma models (Driver, Asset, Load)
- APIs under `/api/companies/:id/branches` and `/departments`

### 3. Branding
- GET/PATCH `/api/companies/:id/branding` (logo, colors, invoice header/footer)
- Trip sheet `PrintPreview` uses tenant `accentColor` when provided

### 4. Feature flags + subscription enforcement
- `GET /api/companies/:id/entitlements` (plan features + maxDrivers)
- Gateway blocks accounting routes when `features.accounting === false`
- Driver create enforces `maxDrivers` from plan
- Company Admin hides Accounting tab when not entitled; Plan panel shows flags

### 5. Company document vault
- `company_local.CompanyDocument` + list/create/delete APIs
- UI under Company → Documents

### 6. API keys + security policies
- `ApiCredential` (create once-shown secret, revoke)
- `SecurityPolicy` (password min length, session days, MFA flag, IP allowlist JSON)
- UI under Company → API Keys / Security

### 7. Richer audit + notification rules
- `AuditEvent` + `ip`, `userAgent`, `before`, `after`
- `NotificationRule` (seed `doc_expiry` → SMS admin); toggle in UI

## Apply to existing tenants

```bash
cd backend/services/company-service
npx prisma migrate deploy
npm run build
npm run schema:migrate-all

# Optional: push branchId columns into tenant ops schemas
cd backend/services/driver-service
# For each tenant DB, set DATABASE_URL=.../fq_tenant_X?schema=driver and:
#   npx prisma db push --skip-generate
# Same for fleet-service with ?schema=fleet
```

New provisions apply `002_phase5_org.sql` automatically after bootstrap.

## Verify

1. Restart company-service + gateway (+ driver/fleet if using branchId)
2. Login as company admin → **Company** tab
3. Edit branding accent → print a trip sheet (pass branding or reload settings)
4. Starter plan: Accounting tab hidden; `/api/invoices` returns 403 via gateway
5. Create API key → copy once → revoke
6. Compliance audit list shows richer fields when new events include IP/UA

## Next

**Phase 6 — Operations excellence** — complete. See [MULTI-TENANT-PHASE-6-COMPLETE.md](./MULTI-TENANT-PHASE-6-COMPLETE.md).
