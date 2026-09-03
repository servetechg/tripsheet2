# Phase 3 complete — Tenant-aware runtime

**Date:** 2026-08-05  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### JWT

Login / `/auth/me` include **`tenantKey`** (company slug) alongside `companyId`, `role`, `sub`, `email`.

Auth resolves `tenantKey` from company-service  
`GET /internal/tenants/:companyId/connection`.

### Gateway TenantResolver

- Validates Bearer JWT (`JWT_SECRET`)
- Public exceptions: `/health`, `POST /api/auth/login`, invite by-token / complete
- Resolves tenant registry (cached) from company-service
- Injects trusted headers (strips client spoofs):
  - `x-user-id`, `x-user-role`, `x-user-email`
  - `x-company-id`, `x-tenant-key`, `x-tenant-status`
  - `x-tenant-routing` = `shared` | `tenant`
  - `x-tenant-db-name`
- Forces `companyId` query param for non-superadmin proxies
- Suspended companies → `403`

### Shared package `@tripsheet/tenant-runtime`

`backend/shared/tenant-runtime` — ALS context, connection cache, Prisma proxy, scope interceptor, middlewares.

### Ops services (driver, fleet, manifest, tripsheet, accounting, notification)

- Read gateway headers into request context
- **TenantScopeInterceptor** forces `companyId` from JWT; filters leaked rows
- **Prisma proxy**: when `x-tenant-routing=tenant`, queries go to  
  `fq_tenant_{slug}?schema=<domain>` (pooled clients)
- Default for existing tenants: **`routingMode=shared`** (shared microservice DB + enforcement) so live data keeps working until Phase 4 ETL

### Routing mode API

```http
PATCH /api/tenants/:companyId/routing-mode
{ "routingMode": "tenant" | "shared" }
```

Global override: gateway `TENANT_RUNTIME_MODE=tenant` forces tenant DB when status=active.

### Schema sync (for tenant routing)

```bash
cd backend/services/company-service
npm run sync:tenant-schemas
# or one DB:
npx ts-node --transpile-only scripts/sync-tenant-schemas.ts fq_tenant_mkx
```

Rebuilds domain schemas via `prisma db push` (empty tenant ops tables until Phase 4).

### PgBouncer

`backend/docker-compose.yml` service **pgbouncer** on host port **6432** (transaction pooling).  
Provision / `CREATE DATABASE` still uses Postgres **5432**.

```bash
cd backend && docker compose up -d pgbouncer
```

### Isolation test

```bash
cd backend/gateway
npm run test:tenancy
```

Company A must not list or spoof company B drivers (and related tenant APIs).

## Config cheat sheet

| Service | Vars |
|---------|------|
| gateway | `JWT_SECRET`, `COMPANY_SERVICE_URL`, `INTERNAL_API_KEY`, `TENANT_RUNTIME_MODE` |
| auth | `COMPANY_SERVICE_URL`, `INTERNAL_API_KEY` |
| ops services | `COMPANY_SERVICE_URL`, `TENANT_DB_SCHEMA`, `INTERNAL_API_KEY` |
| company | `TENANT_DEFAULT_ROUTING_MODE` (new provisions; default `shared`) |

## What Phase 3 does *not* do

- Does **not** ETL existing rows from `driver_db` / `fleet_db` / … into `fq_tenant_*`  
- Existing companies stay on **shared** routing until you sync + flip `routingMode` (or finish Phase 4)

## Verify

1. Restart gateway + auth + company + at least driver-service  
2. Login as company admin — JWT payload has `tenantKey`  
3. Call `GET /api/drivers` with company A token and `?companyId=<B>` — still only A’s drivers  
4. `docker compose up -d pgbouncer` — port 6432 listening  
5. `npm run test:tenancy` in gateway  

## Next

**Phase 4 — Migrate existing shared data** — **DONE**, see [MULTI-TENANT-PHASE-4-COMPLETE.md](./MULTI-TENANT-PHASE-4-COMPLETE.md).
