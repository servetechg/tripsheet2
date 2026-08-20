# FleetQuix — Multi-Tenant Architecture Plan

**Document type:** Architecture Decision Record (ADR) + Implementation Plan  
**Status:** Approved for planning (implementation on request)  
**Version:** 1.0  
**Date:** 2026-08-04  
**Scope:** Database-per-company tenancy (hard isolation) aligned with client Chapter 3 (Company Management & Multi-Tenant Architecture)

---

## 1. Purpose

FleetQuix must operate as a **multi-tenant SaaS TMS** where every company (tenant) has **complete data isolation**.

This plan defines a **professional database-per-tenant** architecture:

- One **platform (control-plane) database** for tenancy, billing, and routing metadata
- One **dedicated PostgreSQL database per company** for all operational data

Implementation begins only when explicitly requested. This document is the source of truth for that work.

---

## 2. Current state (baseline)

| Area | Today |
|------|--------|
| Companies | Super-admin can create companies |
| Data model | Shared service DBs (`fleet_db`, `driver_db`, …) with `companyId` on rows |
| Isolation | Soft (filter by `companyId` in UI/API) — not physical |
| API enforcement | Weak — `companyId` often accepted from client query/body |
| Branches / branding / plans / per-tenant API keys | Not implemented |
| Company profile | Minimal (name, shortName, address, tagline) |

**Conclusion:** Light multi-company support exists. Chapter 3–grade **DB-per-tenant** isolation does **not**.

---

## 3. Architecture decision

### 3.1 Decision

Adopt **hybrid multi-tenancy**:

1. **Platform DB (shared)** — control plane only  
2. **Tenant DB (dedicated Postgres database per company)** — data plane  

### 3.2 Rejected / deferred alternatives

| Alternative | Decision |
|-------------|----------|
| Shared DB + `companyId` only | Insufficient for client hard-isolation requirement |
| 8 physical DBs × N companies (clone today’s microservice DB layout per tenant) | **Rejected** — ops explode; connection/migration cost unmanageable |
| Schema-per-tenant in one shared DB | Deferred as optional mid-tier later; not the client target |
| Full DB-per-tenant for Starter only after Enterprise | Client project standard is dedicated DB; tiers may still gate *features*, not isolation |

### 3.3 Tenant database shape (mandatory)

**One PostgreSQL database per company**, with **schemas per domain** (keeps microservice boundaries without 8×N databases):

```text
fq_platform                          ← shared control plane

fq_tenant_mkx                        ← company MKX
  ├── schema auth
  ├── schema company_local           ← settings, branding, branches (tenant-owned)
  ├── schema driver
  ├── schema fleet
  ├── schema manifest
  ├── schema tripsheet
  ├── schema accounting
  └── schema notification

fq_tenant_nhc                        ← company NHC (same schema layout)
```

Microservices continue to exist; each service uses the **tenant DB** + its **schema** (or search_path), resolved at request time.

---

## 4. High-level system design

```text
                        Internet
                           │
                           ▼
                     Caddy / Edge
                           │
                           ▼
                 API Gateway + Auth
                           │
              JWT: userId, companyId, tenantKey, roles
                           │
              TenantResolver (platform DB)
                           │
              Connection pool → fq_tenant_{slug}
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   driver-service     fleet-service     accounting-service
   (schema driver)    (schema fleet)    (schema accounting)
        │                  │                  │
        └──────────────────┴──────────────────┘
                           │
                    fq_tenant_{slug}
```

### Golden rules

1. **Never trust client-supplied `companyId` alone** — tenant comes from JWT / session.  
2. **Wrong tenant DB must be unreachable** — isolation is physical.  
3. Still store `companyId` inside tenant rows for consistency and defense-in-depth.  
4. Platform DB holds **no** operational load/driver/payroll rows.

---

## 5. Platform DB (control plane)

### 5.1 Responsibilities

- Company registry (id, name, slug, status, plan)
- Tenant database registry (db name, host, port, encrypted credentials ref)
- SaaS subscriptions / feature entitlements
- Super-admin accounts
- Tenant lifecycle audit (provision, suspend, migrate, deprovision)
- Optional: SaaS billing for FleetQuix itself

### 5.2 Core tables (logical)

| Table | Purpose |
|-------|---------|
| `PlatformUser` | Super-admins |
| `Company` | Tenant identity (slug, status, planId) |
| `TenantDatabase` | Connection metadata + secret reference |
| `Subscription` / `Plan` | Starter / Professional / Enterprise |
| `FeatureEntitlement` | Module flags per plan/company |
| `TenantLifecycleEvent` | Provisioning audit |

### 5.3 Secrets

- DB passwords / connection URLs stored in **Vault / sealed secrets / encrypted column**, never plain logs
- Runtime fetches connection via internal API: `GET /internal/tenants/:companyId/connection`

---

## 6. Tenant DB (data plane)

### 6.1 Owned by each company

All Chapter 3 operational and company-config data that is tenant-specific:

- Users (company admin, dispatcher, driver links)
- Drivers, documents, contracts, invites
- Assets, loads, maintenance, DVIR
- Trip sheets, manifests / eManifest
- Settlements, invoices, bills, payments, COA
- Messages, notification logs
- Branches, departments
- Company settings packs, branding
- Company documents vault
- Tenant-local audit events
- Per-company API credentials (hashed)

### 6.2 Still keep `companyId`

Even inside a dedicated DB, every business row includes `companyId` matching the tenant. This supports:

- Future multi-branch reporting
- Safer restores
- Defense if a connection is misconfigured

---

## 7. Request lifecycle

1. User authenticates.  
2. Auth issues JWT containing `companyId`, `tenantKey` (slug), roles, optional `branchIds`.  
3. Gateway validates JWT.  
4. `TenantResolver` loads connection info from **platform DB** (cached).  
5. Downstream services obtain a **pooled connection** to `fq_tenant_{slug}`.  
6. Business queries run only against that database.  
7. Cross-tenant access attempts are impossible at the connection layer; still log denials at authz layer.

### Super-admin

- Operates against **platform DB** only for tenancy/billing.  
- “Impersonate / support access” (if ever required) must be explicit, audited, time-boxed — out of MVP unless client demands it.

---

## 8. Tenant provisioning (create company)

Automated pipeline when super-admin creates a company:

1. Validate unique slug (`mkx`, `nhc`, …).  
2. Create Postgres role + database `fq_tenant_{slug}`.  
3. Create schemas (`auth`, `driver`, `fleet`, …).  
4. Run migrations for all tenant schemas.  
5. Seed defaults: roles, departments, settings, feature flags from plan.  
6. Create first company admin in tenant DB.  
7. Register `TenantDatabase` row in platform DB.  
8. Health-check tenant DB.  
9. Emit lifecycle audit event.

**Scripts (to implement later):**

- `deploy/scripts/provision-tenant.sh`  
- `deploy/scripts/deprovision-tenant.sh` (archive + retain per contract; soft-disable routing first)

---

## 9. Migrations & releases

| Concern | Approach |
|---------|----------|
| Platform migrations | Standard single-DB migrate on deploy |
| Tenant migrations | **Migrate-all-tenants** job: loop registry, apply migrations to each `fq_tenant_*` |
| CI/CD | After image deploy, run platform migrate → tenant migrate-all → smoke |
| Failure | Stop release if any tenant migrate fails; alert; do not silently skip |

Blue/green for app containers stays as today; **tenant DBs are shared across colors** (data plane), same as current shared Postgres.

---

## 10. Connection pooling (non-negotiable)

Risk: `N tenants × services × pool size` exhausts Postgres.

**Required:**

- PgBouncer (or equivalent) in front of Postgres  
- Small per-service pool sizes  
- Cache tenant connection config in gateway/services with TTL  
- Idle disconnect / max clients caps  
- Monitor connections per database

---

## 11. Backup, restore, offboarding

| Operation | Behavior |
|-----------|----------|
| Backup | Nightly dump per `fq_tenant_*` + platform DB |
| Restore | Restore **one** company without touching others |
| Suspend | Disable login + stop routing to tenant DB |
| Offboard | Export dump → contractual retention → drop DB + revoke secrets |
| Branch delete | Soft-archive inside tenant DB (Chapter 3.16) |

---

## 12. Mapping to client Chapter 3

| Chapter section | Where it lives | Phase |
|-----------------|----------------|-------|
| 3.3 Multi-tenant rules | Platform routing + tenant DBs | 0–4 |
| 3.4 Company profile | Tenant DB (+ registry fields on platform) | 5 |
| 3.5 Branches / terminals | Tenant DB | 5 |
| 3.6 Departments | Tenant DB (seeded on provision) | 2 + 5 |
| 3.7 Branding | Tenant DB; applied to PDFs/invoices | 5 |
| 3.8 Settings packs | Tenant DB | 5 |
| 3.9 Feature flags | Platform entitlements (+ tenant cache) | 5 |
| 3.10 Subscription plans | Platform | 1 + 5 |
| 3.11 API credentials | Tenant DB (hashed) | 5 |
| 3.12 Security policies | Tenant DB | 5 |
| 3.13 Company documents | Tenant DB + object storage paths | 5 |
| 3.14 Notifications | Tenant notification schema | 5 |
| 3.15 Audit | Tenant audit + platform lifecycle audit | 3 + 5 |
| 3.16–3.17 Business rules / AC | Enforced across phases | All |

---

## 13. Implementation phases

### Phase 0 — Design lock-in (3–5 days)

- [x] Client signs this ADR (1 DB per company, schemas per domain) — see `MULTI-TENANT-PHASE-0-LOCKIN.md`
- [x] Naming convention: `fq_tenant_{slug}`
- [x] Hosting capacity estimate (disk, connections, PgBouncer)
- [x] Backup/retention SLA written

**Exit:** Signed approval to build. **DONE 2026-08-05**

---

### Phase 1 — Platform control plane (1–2 weeks)

- [x] Create platform schema in `company_db` (control plane)
- [x] `Company`, `TenantDatabase`, `Plan`, `Subscription` models
- [x] Encrypt connection secret references (`PLATFORM_SECRETS_KEY`)
- [x] Internal API: resolve tenant connection by `companyId`
- [x] Super-admin UI talks to platform APIs (plans + tenant registry fields)

**Exit:** Companies registered without yet splitting ops data. **DONE 2026-08-05**

---

### Phase 2 — Provisioning automation (2–3 weeks)

- [x] `provision-tenant` creates DB + schemas + migrates + seeds
- [x] `deprovision-tenant` suspends/archives safely
- [x] Wire “Create Company” in SuperAdmin to provisioning pipeline
- [x] Idempotent retries; clear failure states (`provisioning`, `active`, `failed`)

**Done:** see [MULTI-TENANT-PHASE-2-COMPLETE.md](./MULTI-TENANT-PHASE-2-COMPLETE.md)

**Exit:** New company ⇒ new empty tenant DB automatically.

---

### Phase 3 — Tenant-aware runtime (2–4 weeks)

- [x] JWT includes `companyId` + `tenantKey`  
- [x] Gateway `TenantResolver` middleware  
- [x] Dynamic DB/Prisma datasource (or pool map) per tenant in each service  
- [x] Remove insecure “optional companyId” list-all behavior for company roles  
- [x] PgBouncer deployed and tuned  
- [x] Integration tests: Company A token cannot read Company B data  

**Done:** see [MULTI-TENANT-PHASE-3-COMPLETE.md](./MULTI-TENANT-PHASE-3-COMPLETE.md)

**Exit:** App reads/writes correct tenant DB per request (when `routingMode=tenant`); otherwise enforces JWT company on shared DBs.

---

### Phase 4 — Migrate existing shared data (2–3 weeks)

For each existing company (e.g. MKX, NHC):

- [x] Provision tenant DB  
- [x] ETL copy `WHERE companyId = X` from shared service DBs → tenant schemas  
- [x] Row-count and checksum verification  
- [x] Feature-flag cutover per company  
- [x] Dual-run / freeze shared writes for cut-over company  
- [x] Retire shared ops data (or keep read-only archive)  

**Done:** see [MULTI-TENANT-PHASE-4-COMPLETE.md](./MULTI-TENANT-PHASE-4-COMPLETE.md)

**Exit:** All live companies on dedicated DBs (after running migrate + cutover + optional archive).

---

### Phase 5 — Chapter 3 product modules (6–10 weeks)

Build on isolation (order can be adjusted by client priority):

1. [x] Full company profile + settings packs  
2. [x] Branches & departments + assignment to drivers/assets/loads  
3. [x] Branding applied to invoices/contracts/sheets  
4. [x] Feature flags + subscription enforcement  
5. [x] Company document vault  
6. [x] Per-company API keys + security policies  
7. [x] Richer audit (IP, device, old/new) + admin notification rules  

**Done:** see [MULTI-TENANT-PHASE-5-COMPLETE.md](./MULTI-TENANT-PHASE-5-COMPLETE.md)

**Exit:** Chapter 3 acceptance criteria met on dedicated tenancy.

---

### Phase 6 — Operations excellence (continuous)

- [x] Migrate-all-tenants in CI/CD  
- [x] Per-tenant backup cron + restore drill quarterly  
- [x] Dashboards: connections, disk, errors per tenant  
- [x] Runbooks: suspend, restore, offboard  
- [x] Load test with simulated N tenants  

See [MULTI-TENANT-PHASE-6-COMPLETE.md](./MULTI-TENANT-PHASE-6-COMPLETE.md).

---

## 14. Acceptance criteria (architecture)

### Tenant creation

**Given** a super-admin creates a company,  
**When** provisioning completes,  
**Then** a unique Company ID exists, a dedicated `fq_tenant_{slug}` database is online, defaults are seeded, and the company admin can log in only to that tenant’s data.

### Isolation

**Given** two companies A and B,  
**When** a user from A calls any operational API,  
**Then** no row from B’s tenant database is readable or writable.

### Restore

**Given** a backup of company A’s tenant DB,  
**When** restore is performed,  
**Then** only A’s data is affected; B remains unchanged.

### Branding (Chapter 3.17)

**Given** company branding is configured in the tenant DB,  
**When** invoices/contracts are generated,  
**Then** that company’s branding is applied.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Connection exhaustion | PgBouncer + small pools + monitoring |
| Migrate-all takes too long | Parallelism with concurrency cap; expand-contract migrations |
| Provisioning failure mid-way | Stateful status machine; compensating cleanup |
| Higher infra cost | Price into Enterprise / per-tenant fee; capacity planning |
| Microservice complexity | One tenant DB + schemas (not 8 DBs per company) |
| Accidental shared-DB queries post-cutover | Remove shared ops connection strings from app env |

---

## 16. Cost & commercial note (for client discussions)

Dedicated DB per company is an **Enterprise-grade isolation model**. Expect linear growth in:

- Storage  
- Backup volume  
- Migration runtime  
- Operational attention  

Recommend aligning subscription tiers (Chapter 3.10) so **Starter/Professional/Enterprise** gate *features and limits*, while **data isolation remains dedicated** as the platform standard for this client project.

---

## 17. Relationship to existing deploy

| Concern | Approach |
|---------|----------|
| Staging / production | Same tenancy model; staging may use fewer/smaller tenant DBs |
| Blue/green | App colors only; Postgres (platform + tenants) is shared data plane |
| Secrets | Extend `/opt/tripsheet/secrets` + vault pattern for platform + provisioning credentials |
| Image build | Unchanged; runtime gains tenant resolver + migrate-all |

---

## 18. Out of scope for first isolation MVP

- Live customer portal white-label domains (later)  
- SSO (Enterprise later)  
- Automatic load-board broker DBs  
- AI features  
- Moving object storage (Cloudinary) to per-tenant cloud accounts (paths/folders per company first; separate cloud accounts optional later)

---

## 19. Implementation trigger

**Do not implement until explicitly requested.**

When implementing, follow phase order **0 → 4** before large Chapter 3 UI work, so product features land on the correct isolation model.

Suggested kickoff command for the team:

> “Implement Phase 1 (platform control plane) per `docs/MULTI-TENANT-DB-PER-COMPANY.md`.”

---

## 20. Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-04 | Initial professional plan: DB-per-company + platform control plane |

---

# End of multi-tenant architecture plan
