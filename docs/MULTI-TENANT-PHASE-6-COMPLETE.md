# Phase 6 complete — Operations excellence

**Date:** 2026-08-17  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### 1. Migrate-all-tenants in CI/CD
- `POST /tenants/schema-migrate-all` — applies `company_local` Phase 5+ org SQL to every **active** tenant; optionally non-destructive Prisma `db push` when sibling service trees exist on disk
- `deploy/scripts/migrate-all-tenants.sh` + `npm run schema:migrate-all`
- Staging + production GitHub Actions run schema-migrate-all after deploy (`docker exec … node fetch`)
- On-demand: `.github/workflows/tenant-migrate.yml`

### 2. Per-tenant backup + restore drill
- `deploy/scripts/backup.sh` dumps shared DBs **and** all `fq_tenant_*` into `backups/<stamp>/tenants/`
- `deploy/scripts/restore-tenant.sh` — restore one tenant (`--force` to replace)
- `deploy/scripts/restore-drill.sh` — quarterly throwaway restore + schema check + drop
- Cron example documented in `deploy/README.md`

### 3. Ops dashboard
- `GET /tenants/ops/summary` — per-tenant status, `lastError`, disk size, live connections; totals + recent lifecycle errors
- Super Admin → **Tenant ops** tab (`TenantOpsDashboard.tsx`) with refresh + schema migrate-all

### 4. Runbooks
- [docs/runbooks/suspend-tenant.md](./runbooks/suspend-tenant.md)
- [docs/runbooks/restore-tenant.md](./runbooks/restore-tenant.md)
- [docs/runbooks/offboard-tenant.md](./runbooks/offboard-tenant.md)

### 5. Load test
- `backend/gateway/scripts/multi-tenant/load.test.ts`
- `cd backend/gateway && npm run test:load`
- Env: `TENANT_N`, `CONCURRENCY`, `REQUESTS`, `GATEWAY_URL`, `COMPANY_URL`

## Verify locally

```bash
# company-service running
curl -s http://localhost:3002/tenants/ops/summary | head
curl -s -X POST http://localhost:3002/tenants/schema-migrate-all

# load test (gateway up)
cd backend/gateway
TENANT_N=5 CONCURRENCY=10 REQUESTS=50 npm run test:load

# backup / drill (Docker Postgres)
# ./deploy/scripts/backup.sh
# ./deploy/scripts/restore-drill.sh
```

Frontend: login as superadmin → **Tenant ops**.

## Notes
- Schema migrate-all is **not** Phase 4 ETL (`/tenants/migrate-all`). It only upgrades schemas.
- Slim production images skip ops Prisma push (no sibling trees); org SQL still applies. Full push: run CLI from monorepo checkout with `npm run schema:migrate-all`.
- Backup retention default: 14 days (`BACKUP_RETENTION_DAYS`).
