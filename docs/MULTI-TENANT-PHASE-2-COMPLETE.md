# Phase 2 complete — Tenant DB provisioning

**Date:** 2026-08-05  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### Provisioner (`company-service`)

On company create (and on explicit retry):

1. `CREATE DATABASE fq_tenant_{slug}` (idempotent if already exists)
2. Apply `src/tenants/sql/001_bootstrap.sql` — schemas + core tables for  
   `company_local`, `auth`, `driver`, `fleet`, `manifest`, `tripsheet`, `accounting`, `notification`
3. Seed defaults: departments, settings, branding, HQ branch, COA stubs
4. Encrypt connection URL into `TenantDatabase.connectionCiphertext`
5. Set statuses: company + tenant → `active` (or `failed` with `lastError`)

Soft **deprovision** revokes CONNECT and marks `suspended` (DB kept).  
Optional `?dropDatabase=true` destroys the database.

### APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tenants/:companyId/provision` | Provision / retry (`{ force?: true }`) |
| POST | `/api/tenants/:companyId/deprovision` | Suspend; `?dropDatabase=true` to drop |
| POST | `/api/tenants/provision-pending` | Backfill all `pending_provision` / `failed` |
| POST | `/internal/tenants/:companyId/provision` | Same, requires `x-internal-api-key` |

Create company (`POST /api/companies`) now registers + **provisions immediately**.

Disable company soft-deprovisions; Enable re-provisions with `force`.

### Config

```env
TENANT_PROVISION_URL=postgresql://tripsheet:tripsheet@localhost:5432/postgres
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5432
PLATFORM_SECRETS_KEY=...   # encrypts connection strings
```

Postgres role needs `CREATEDB` (default `POSTGRES_USER` in Docker is superuser).

### UI

Super-admin company cards: **Provision DB** / **Retry provision** when status is pending/failed; create success reflects provisioned status.

### Scripts

```bash
# CLI backfill (loads Nest + .env)
cd backend/services/company-service
npx ts-node --transpile-only scripts/provision-pending-tenants.ts

# HTTP helper
COMPANY_URL=http://localhost:3002 ./deploy/scripts/provision-tenant.sh
COMPANY_URL=http://localhost:3002 ./deploy/scripts/provision-tenant.sh <companyId>
```

## How to verify

1. Ensure `TENANT_PROVISION_URL` / `PLATFORM_SECRETS_KEY` in company-service `.env`
2. Restart company-service (+ gateway if used)
3. Create a company in Super Admin
4. Card shows tenant status **active** and `fq_tenant_{slug}`
5. In Postgres: `\l` lists `fq_tenant_*`; `\c fq_tenant_…` then `\dn` shows domain schemas
6. Disable company → status **suspended**; Enable → active again

## What Phase 2 does *not* do

- Does **not** route driver/fleet/accounting requests to the tenant DB yet  
- Shared microservice DBs still hold operational data  

That is **Phase 3** (JWT `tenantKey` + gateway TenantResolver + dynamic Prisma).

## Next

**Phase 3 — Runtime tenant routing** — **DONE**, see [MULTI-TENANT-PHASE-3-COMPLETE.md](./MULTI-TENANT-PHASE-3-COMPLETE.md).
