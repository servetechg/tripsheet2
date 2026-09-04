# Phase 4 complete — Migrate shared data → tenant DBs

**Date:** 2026-08-05  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### Registry fields (`TenantDatabase`)

| Field | Purpose |
|-------|---------|
| `etlStatus` | `pending` → `syncing` → `copying` → `verifying` → `verified` → `cutover` → `archived` (or `failed`) |
| `etlReport` | Per-table counts + checksums |
| `etlVerifiedAt` | When verify passed |
| `writeFreeze` | Block mutating requests while still on shared routing |
| `cutoverAt` | When `routingMode` flipped to `tenant` |
| `archivedAt` | When shared-DB rows deleted |

### ETL pipeline (`EtlService`)

For each company:

1. Ensure tenant DB provisioned  
2. **Sync** ops Prisma schemas into `fq_tenant_*` (`driver`, `fleet`, `manifest`, `tripsheet`, `accounting`, `notification`)  
3. **Copy** `WHERE "companyId" = X` from each shared `*_db` → tenant schema (FK-safe order)  
4. **Verify** row counts + id checksums match  
5. **Freeze** (optional) shared writes via gateway  
6. **Cutover** → `routingMode=tenant`, `writeFreeze=true`  
7. **Archive** (optional) `DELETE` company rows from shared microservice DBs  

Auth users stay on `auth_db` (not archived).

### APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tenants/:id/migrate` | Sync + copy + verify |
| POST | `/api/tenants/:id/verify` | Re-check counts only |
| POST | `/api/tenants/:id/freeze` | Set `writeFreeze` |
| POST | `/api/tenants/:id/unfreeze` | Clear freeze |
| POST | `/api/tenants/:id/cutover` | Flip to tenant routing (requires `verified`) |
| POST | `/api/tenants/:id/archive-shared` | Delete shared copies |
| POST | `/api/tenants/migrate-all` | ETL every active tenant |
| POST | `/api/tenants/cutover-all` | Cut over all `verified` |

### Scripts

```bash
cd backend/services/company-service

# One company
npx ts-node --transpile-only scripts/migrate-all-tenants.ts <companyId>
npx ts-node --transpile-only scripts/migrate-all-tenants.ts <companyId> --cutover
npx ts-node --transpile-only scripts/migrate-all-tenants.ts <companyId> --cutover --archive

# All tenants
npm run migrate:tenants
npm run migrate:tenants -- --cutover

# HTTP
COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh
COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh <companyId> cutover
```

### Gateway freeze

When `writeFreeze=true` and `routingMode=shared`, mutating requests (`POST/PUT/PATCH/DELETE`) return **403**  
(“frozen during tenant migration cutover”). After cutover, traffic uses the tenant DB so writes proceed normally.

### Super-admin UI

Company cards show `etl` status / frozen; buttons: **Migrate ETL**, **Cut over**, **Archive shared**.

### Config

```env
SHARED_DB_BASE=postgresql://tripsheet:tripsheet@localhost:5432/postgres
# optional overrides:
# SHARED_DRIVER_DB_URL=...
```

## Recommended cutover order (production)

1. `migrate` → confirm `etlStatus=verified` and report `ok: true`  
2. `freeze` (optional short maintenance window)  
3. `cutover`  
4. Smoke-test ops reads/writes for that company  
5. `archive-shared` once confident  

## Verify

```bash
cd backend/services/company-service
npx prisma migrate deploy
npm run migrate:tenants -- --cutover
```

Then in Postgres: company rows exist under `fq_tenant_{slug}.driver."Driver"` etc., and registry shows `routingMode=tenant`, `etlStatus=cutover`.

## What Phase 4 does *not* do

- Does not move **auth** users into tenant `auth` schema (still `auth_db`)  
- Does not auto-archive without an explicit archive call  

## Next

**Phase 5 — Chapter 3 product modules** — **DONE**, see [MULTI-TENANT-PHASE-5-COMPLETE.md](./MULTI-TENANT-PHASE-5-COMPLETE.md).
