# Phase 1 complete — Platform control plane

**Date:** 2026-08-05  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## What shipped

### Database (`company_db` = platform control plane)

| Model | Role |
|-------|------|
| `Plan` | starter / professional / enterprise + feature JSON |
| `Company` | + `slug`, `status`, `planId` |
| `Subscription` | company ↔ plan |
| `TenantDatabase` | registry for `fq_tenant_{slug}`; status `pending_provision` until Phase 2 |
| `TenantLifecycleEvent` | company.created, registry, subscription, suspend |

Connection strings are stored encrypted (`PLATFORM_SECRETS_KEY`, AES-256-GCM). Empty until Phase 2 provisions a real DB.

### APIs (company-service → gateway)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/plans` | List plans |
| GET | `/api/plans/:code` | Plan by code |
| GET | `/api/tenants` | Tenant DB registry (no secrets) |
| GET | `/api/tenants/:companyId` | Safe tenant status |
| GET | `/internal/tenants/:companyId/connection` | Decrypt URL (needs `x-internal-api-key`) |
| PATCH | `/internal/tenants/:companyId/connection` | Set connection after provision |
| POST | `/api/companies` | Creates company + subscription + pending tenant row |
| POST | `/api/companies/:id/plan` | Change plan |

### UI

Super-admin create company: choose plan; preview `fq_tenant_{slug}`; company cards show slug, plan, tenant DB name + status; plan dropdown to change tier.

### Local apply

```bash
cd backend/services/company-service
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts
```

Restart **company-service** and **gateway**.

## What Phase 1 does *not* do

- Does **not** create physical `fq_tenant_*` databases yet  
- Does **not** route fleet/driver traffic to per-company DBs  
- Ops data still lives in shared microservice DBs  

That is **Phase 2** (provision) and **Phase 3** (runtime routing).

> **Update:** Phase 2 is complete — see [MULTI-TENANT-PHASE-2-COMPLETE.md](./MULTI-TENANT-PHASE-2-COMPLETE.md).

## How to verify

1. Restart company-service + gateway  
2. Login as super-admin  
3. Create a company with plan Professional  
4. Confirm card shows `slug`, `fq_tenant_…`, status **pending provision**  
5. `GET /api/plans` returns 3 plans  
6. `GET /api/tenants` lists registry rows  

## Next

**Phase 2 — Provisioning automation:** create real Postgres DB + schemas + migrate + seed when a company is created.
