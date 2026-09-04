# Chapter 3 — Multi-Tenant Architecture: Full Testing Guide

**Version:** 1.0  
**Date:** 2026-08-29  
**Scope:** DB-per-company, provisioning, routing mode, isolation, plan gates, suspend, ops dashboard (Phases 0–6).

Related: [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) · [MULTI-TENANT-PHASE-6-COMPLETE.md](./MULTI-TENANT-PHASE-6-COMPLETE.md) · [runbooks/suspend-tenant.md](./runbooks/suspend-tenant.md)

---

## 1. Before you start

### 1.1 Start the stack

```powershell
cd C:\other-projects\tripsheet\backend
npm run infra:up          # postgres + redis + pgbouncer
npm run start:dev
```

```powershell
cd C:\other-projects\tripsheet\frontend
npm run dev
```

**Verify:**

- `http://localhost:3000/health` — gateway  
- `http://localhost:3002/health` — company-service (tenant registry)  
- Docker: `tripsheet-postgres` healthy  

### 1.2 Bootstrap platform + MKX tenant

```powershell
cd C:\other-projects\tripsheet\backend\services\company-service
npx prisma migrate deploy
npx prisma db seed

cd C:\other-projects\tripsheet\backend\services\driver-service
npx prisma migrate deploy
```

**Provision MKX tenant** (if status is `pending_provision`):

```http
POST http://localhost:3000/api/tenants/c1/provision
Authorization: Bearer <super-admin-token>
```

**Cut over to tenant routing** (MKX uses `fq_tenant_mkx`):

```http
POST http://localhost:3000/api/tenants/c1/cutover
Authorization: Bearer <super-admin-token>
```

Or Super Admin UI → tenant row → provision / cutover actions.

### 1.3 Test accounts

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Super Admin | `admin@tripsheet.io` | `admin123` | Platform (`company_db`) |
| MKX Owner | `admin@mkx.ca` | `mkx123` | `c1` → `fq_tenant_mkx` |

Ephemeral tenants are created automatically by live tests (cleaned up unless `--keep`).

---

## 2. Automated tests (run first)

### 2.1 Architecture suite (Phases 1–6)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:tenancy
```

From gateway with options:

```powershell
cd backend\gateway
npm run test:tenancy              # provision 2 ephemeral tenants, cleanup
npm run test:tenancy:keep         # leave companies + DBs
npm run test:tenancy:existing     # use 2 existing active tenants (e.g. MKX + another)
```

**What it proves:**

| Suite | Validates |
|-------|-----------|
| 0 Health | Gateway up |
| 1 Auth + tenantKey | JWT includes `tenantKey` / slug |
| 2 Registry + provision | `GET /api/tenants`; `fq_tenant_{slug}` DB names |
| 3 Isolation | A cannot list/read/write B’s drivers; spoof `companyId` / headers blocked |
| 4 Org + entitlements | Branding isolated; starter blocks accounting; professional allows |
| 5 Suspend | Disable A → 403; B still works; re-enable restores |
| 6 Ops | `/api/tenants/ops/summary`; `schema-migrate-all` |

### 2.2 Load test (optional)

```powershell
cd backend\gateway
$env:TENANT_N = "5"
$env:CONCURRENCY = "10"
$env:REQUESTS = "50"
npm run test:load
```

Env: `GATEWAY_URL`, `COMPANY_URL`, `TENANT_N`, `CONCURRENCY`, `REQUESTS`.

### 2.3 Related suites

Tenant isolation also covered indirectly by:

```powershell
npm run test:rbac:live
npm run test:auth:live
npm run test:drivers:live
```

---

## 3. Manual UI testing — by feature

Super Admin UI: login as `admin@tripsheet.io` → **Admin** workspace → **Tenant ops** (or Companies / Tenants list).

### Phase 1–2 — Registry & provisioning

| # | Steps | Expected result |
|---|--------|-----------------|
| 1.1 | Super Admin → tenant list | Companies with `dbName`, status, routing mode |
| 1.2 | Create new company (platform) | Row in registry; status `pending_provision` |
| 1.3 | **Provision** tenant | Status `active`; PostgreSQL DB `fq_tenant_{slug}` exists |
| 1.4 | Company admin logs in | JWT `tenantKey` matches company slug |
| 1.5 | Registry response | No `connectionUrl` / secrets leaked to browser |

---

### Phase 3 — Routing mode (shared vs tenant)

| # | Steps | Expected result |
|---|--------|-----------------|
| 3.1 | Check MKX tenant row | `routingMode: tenant`, `dbName: fq_tenant_mkx` |
| 3.2 | MKX owner creates driver | Row in **tenant** DB (`driver` schema), not shared `driver_db` |
| 3.3 | Public driver invite (incognito) | Resolves invite in tenant DB |
| 3.4 | Flip routing to `shared` (dev only) | Data reads/writes hit shared service DB again |

**Warning:** Cutover + ETL are destructive migration steps — use ephemeral tenants for experiments.

---

### Phase 4 — ETL & cutover (advanced / ops)

| # | Steps | Expected result |
|---|--------|-----------------|
| 4.1 | `POST /api/tenants/:id/migrate` | ETL copies shared rows → tenant; verify counts |
| 4.2 | `POST /api/tenants/:id/verify` | Checksums match |
| 4.3 | `POST /api/tenants/:id/cutover` | `routingMode=tenant` |
| 4.4 | `POST /api/tenants/:id/archive-shared` | Shared copies removed (after cutover) |

Run on **non-production** tenants only unless following runbooks.

---

### Phase 5 — Plan gates & entitlements

| # | Steps | Expected result |
|---|--------|-----------------|
| 5.1 | Company on **starter** plan → open Accounting | 403 or feature hidden |
| 5.2 | Super admin upgrades to **professional** | Accounting API returns 200 |
| 5.3 | `GET /api/companies/{id}/entitlements` | `features.accounting`, `maxDrivers`, etc. |

---

### Phase 6 — Operations dashboard

| # | Steps | Expected result |
|---|--------|-----------------|
| 6.1 | Super Admin → **Tenant ops** | Per-tenant status, disk, connections, errors |
| 6.2 | **Schema migrate all** button / API | Success count ≥ 1; tenant org SQL applied |
| 6.3 | Suspend company (toggle active OFF) | Company admin APIs 403 within ~60s (cache TTL) |
| 6.4 | Re-enable company | Access restored |
| 6.5 | Review runbooks | [suspend](./runbooks/suspend-tenant.md), [restore](./runbooks/restore-tenant.md), [offboard](./runbooks/offboard-tenant.md) |

---

### Isolation spot-checks (two companies)

| # | Steps | Expected result |
|---|--------|-----------------|
| I.1 | Login as Company A admin → list drivers | Only A’s drivers |
| I.2 | Login as Company B admin | No A drivers visible |
| I.3 | A patches branding color | B’s branding unchanged |
| I.4 | A calls API with `?companyId=B` | B’s data not returned |

---

## 4. API reference (gateway `:3000`)

Super-admin bearer required unless noted.

### Registry & lifecycle

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenants` | Tenant registry (no secrets) |
| GET | `/api/tenants/:companyId` | One tenant metadata |
| POST | `/api/tenants/:companyId/provision` | Create / retry tenant DB |
| POST | `/api/tenants/:companyId/deprovision` | Soft suspend; `?dropDatabase=true` destroys |
| PATCH | `/api/tenants/:companyId/routing-mode` | `{ "routingMode": "tenant" \| "shared" }` |
| POST | `/api/tenants/:companyId/migrate` | ETL shared → tenant |
| POST | `/api/tenants/:companyId/cutover` | Flip routing after verify |
| PATCH | `/api/companies/:id/toggle-active` | Suspend / re-enable company |

### Ops (Phase 6)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenants/ops/summary` | Ops dashboard data |
| POST | `/api/tenants/schema-migrate-all` | Apply org SQL to all active tenants |
| POST | `/api/tenants/provision-pending` | Backfill pending tenants |

### Entitlements

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/companies/:id/entitlements` | Plan features (company admin OK) |
| POST | `/api/companies/:id/plan` | Change plan (super admin) |

### Example: verify MKX routing

```powershell
# Super admin login, then:
Invoke-RestMethod -Uri "http://localhost:3000/api/tenants/c1" `
  -Headers @{ Authorization = "Bearer $superToken" }
# Expect: dbName=fq_tenant_mkx, routingMode=tenant, status=active
```

### Example: schema migrate all tenants

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/tenants/schema-migrate-all" `
  -Headers @{ Authorization = "Bearer $superToken" }
```

---

## 5. Validation matrix (server rules)

| Rule | Enforced by | How to test |
|------|-------------|-------------|
| JWT companyId is source of truth | Gateway tenant resolver | Spoof query/header fails |
| Tenant DB per company | company-service + prisma proxy | Row in `fq_tenant_*` only |
| Suspended company blocked | Session cache + company status | toggle-active → 403 |
| Plan feature gates | Gateway entitlements | Starter accounting 403 |
| Registry never leaks connection URL | tenants API | `test:tenancy` §2 |
| Public invite resolves tenant | driver-service | Incognito invite on MKX |
| Schema migrate-all idempotent | tenant-ops | Run twice; no crash |

---

## 6. Acceptance sign-off (architecture)

| # | Requirement | Automated | Manual UAT |
|---|-------------|-----------|------------|
| 1 | Two tenants fully isolated | `test:tenancy` §3 | §3 Isolation I.1–I.4 |
| 2 | Provision + tenantKey on JWT | `test:tenancy` §2 | §3 Phase 1 |
| 3 | Suspend blocks one tenant only | `test:tenancy` §5 | §3 Phase 6 row 6.3 |
| 4 | Ops summary + schema migrate | `test:tenancy` §6 | §3 Phase 6 rows 6.1–6.2 |
| 5 | Plan gates accounting | `test:tenancy` §4 | §3 Phase 5 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| MKX data “missing” after cutover | Data is in `fq_tenant_mkx`; query tenant DB not shared |
| Invite invalid in incognito | Tenant routing + public lookup — see AUTH guide §7 |
| 403 after suspend, OK after re-enable | Wait up to 60s for session/tenant cache TTL |
| `provision` fails | Check postgres logs; `lastError` on tenant row |
| `schema-migrate-all` skips push | Slim deploy images skip Prisma push; org SQL still runs |
| `test:tenancy:existing` needs 2 tenants | Provision second company or use `--keep` from prior run |
| Port 5432 in use | Docker postgres already running — use container |

### DB inspection (dev)

```powershell
# List tenant DBs
docker exec tripsheet-postgres psql -U tripsheet -d company_db -c "SELECT \"companyId\", \"dbName\", status, \"routingMode\" FROM \"TenantDatabase\";"

# MKX invites (tenant)
docker exec tripsheet-postgres psql -U tripsheet -d fq_tenant_mkx -c "SELECT token, status FROM driver.\"Invite\" LIMIT 5;"
```

---

## 8. What is explicitly out of scope (do not test as bugs)

- Cross-region tenant failover  
- Automatic shard rebalancing  
- Per-tenant custom Postgres version  
- Billing metered by DB size (plan gates only)  
- 8 physical DBs × N companies (we use 1 DB × N tenants with schemas)  

---

## 9. Quick daily smoke (5 minutes)

1. `npm run test:tenancy:existing` (if ≥2 active tenants) or `npm run test:tenancy`  
2. Super admin → Tenant ops loads  
3. MKX admin creates driver → appears in roster  
4. `GET /api/tenants/ops/summary` returns ≥1 tenant  
5. Optional: `npm run test:load` with low `REQUESTS`  

---

## 10. Backup & restore drill (ops)

Documented in [MULTI-TENANT-PHASE-6-COMPLETE.md](./MULTI-TENANT-PHASE-6-COMPLETE.md):

```bash
./deploy/scripts/backup.sh
./deploy/scripts/restore-drill.sh
./deploy/scripts/restore-tenant.sh fq_tenant_mkx --force
```

Run quarterly on staging; not required for feature dev smoke.

---

**End of Chapter 3 Testing Guide**
