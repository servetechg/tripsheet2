# Phase 1 complete — Permission catalog + JWT

**Date:** 2026-08-19  
**Parent:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)

## What shipped

Chapter 2 RBAC starts here. Isolation by company is unchanged. This phase answers **which codes a user carries**, not yet **which routes are blocked**.

### Database (`auth_db`)

| Change | Detail |
|--------|--------|
| `Role` enum | `company_admin` renamed to `company_owner`; added GM, dispatcher, dispatcher supervisor, fleet, safety, accountant, HR, maintenance |
| `Permission` | Global catalog (55 codes, `module.action`) |
| `SystemRole` | 10 company templates (Super Admin is platform-only, not in this table) |
| `RolePermission` | Role → permission grants |

Existing users with `company_admin` are renamed in place. API still accepts `company_admin` and stores `company_owner`.

### Auth API

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/auth/login` | JWT + user include `permissions[]`. Role is `company_owner` (not `company_admin`) |
| GET | `/api/auth/me` | Same `permissions[]` |
| GET | `/api/auth/roles` | System role catalog (for later UI) |
| GET | `/api/auth/permissions` | Permission catalog |
| POST/PATCH | `/api/auth/users` | Accepts `company_admin` alias |

JWT payload: `{ sub, email, role, companyId, tenantKey, permissions }`.

- **Company Owner** — all catalog codes (fallback: if seed has not run, still the full list).  
- **Super Admin** — `permissions: []` (platform role, not in-tenant).  
- Other system roles — matrix grants from the catalog.

Catalog is upserted on auth-service boot and in `prisma/seed.ts`.

### UI / shared

- Shared `Role` list includes the 10 company roles + `superadmin`.  
- `/app` still belongs to **company owner** only (`company_owner` or legacy `company_admin`). Other personas are not given the admin shell yet; they land on `/workspace` until Phase 2.  
- Creating a company still creates a **company owner**. Owner keeps every company-admin tab.

## What Phase 1 does *not* do

- Does **not** 403 dispatcher vs accountant on the gateway or services  
- Does **not** hide Company Admin tabs by permission  
- Does **not** add custom tenant roles, MFA, lockout, or invite-for-dispatcher  

That is **Phase 2** (enforce + UI) and later phases.

## Local apply

```bash
cd backend/services/auth-service
npx prisma migrate deploy
npx prisma generate
npx ts-node --transpile-only prisma/seed.ts
```

Restart **auth-service** (and gateway if it is already running). Existing sessions: refresh or log in again so `/auth/me` returns `company_owner` + `permissions`.

## How to verify

1. Apply the migration and seed (or just restart auth-service after migrate — boot syncs the catalog).  
2. Login as `admin@mkx.ca` / `mkx123`.  
3. Response `user.role` is `company_owner`.  
4. `user.permissions` includes `company.delete`, `dispatch.create`, `payroll.process`, `admin.settings`.  
5. JWT `role` is `company_owner`; owner still lands on `/app/dashboard` with every tab.  
6. Login as super-admin: `role` is `superadmin`, `permissions` is `[]`.  
7. `GET /api/auth/roles` returns 10 system roles.  
8. `POST /api/auth/users` with `"role": "company_admin"` still succeeds and stores `company_owner`.

## Next

**Phase 3 complete** — see [RBAC-PHASE-3-COMPLETE.md](./RBAC-PHASE-3-COMPLETE.md). Next: Phase 4 auth hardening.
