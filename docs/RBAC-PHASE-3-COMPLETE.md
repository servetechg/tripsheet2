# Phase 3 complete — Custom roles

**Date:** 2026-08-19  
**Parent:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)

## What shipped

Company owners can compose **tenant-owned custom roles** from the v1 permission catalog. Grants ride on the JWT the same way system roles do. Custom roles are **not** extra Prisma `Role` enum values and do **not** live in `auth_db`.

### Model

| Piece | Where | Notes |
|--------|--------|--------|
| System `User.role` | `auth_db` | Routing only (staff `/app` vs driver vs owner). Unchanged 10-role enum. |
| `User.customRoleId` | `auth_db` | Optional pointer to tenant `company_local."CustomRole".id` |
| `CustomRole` + grants | tenant DB, schema `company_local` | Per-company name, `baseRole`, permission codes |

When `customRoleId` is set, login/`/auth/me` load that role’s grants from company-service and put them on the JWT. They **replace** the system template — they are not unioned. If the tenant lookup fails, auth falls back to the system `role` template so the user is not locked out.

**Cannot** use `company_owner` or `superadmin` as a custom `baseRole`. **Cannot** grant `company.delete` on a custom role (stripped on write). **Cannot** assign a custom role to Company Owner or Super Admin. `baseRole` is frozen after create (reassign the user instead).

### APIs

Company-service (proxied as `/api/companies/:id/...`):

- `GET/POST /companies/:companyId/custom-roles`
- `GET/PATCH/DELETE /companies/:companyId/custom-roles/:roleId`

Internal (auth-service, `x-internal-api-key`):

- `GET /internal/tenants/:companyId/custom-roles/:roleId`

Auth:

- `PATCH /auth/users/:id` accepts `customRoleId` (`null` clears). Requires `users.assign_role`.
- Public user + JWT include `customRoleId` and `customRoleName`.
- `GET /auth/roles` includes `permissions[]` so the composer can clone a system template.

Gateway: mutating custom-role routes need `users.assign_role` (GET needs `users.view` or `users.assign_role`). Company Owner still bypasses in-tenant gates.

### Audit

- `permission.modified` on custom-role create / update / delete (`entityType = custom_role`).
- `role.changed` when a user’s system role or `customRoleId` changes (`entityType = user`).

### UI

Company → **Roles**: checkbox groups by catalog module, optional “start from system template.”  
Company → **Users**: assign a system role or a custom role. The user must **sign in again** for the JWT to refresh.

## What Phase 3 does *not* do

- Password policy / lockout / MFA / `tokenVersion` (Phase 4)
- Forced JWT refresh without re-login
- Extra Prisma role enum values, or storing custom role rows in `auth_db`
- Staff invite that creates a custom role on complete (invite a system role, then assign)

## Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/company-service && npm run build
# existing tenants: first custom-role API call applies 003_custom_roles.sql
# or: POST /api/tenants/schema-migrate-all (Super Admin)
```

Restart **gateway**, **auth-service**, **company-service**, and the frontend. Re-login after assigning a custom role.

## How to verify

1. `cd backend/gateway && npm run test:rbac`
2. `cd backend/services/company-service && npm run test:rbac`
3. As owner: Company → Roles → compose “Payroll clerk” from Accountant template, uncheck `dispatch.create` if present, save.
4. Users tab → assign that role to a staff user → that user logs in → Accounting visible, dispatch mutating APIs **403**.
5. `GET /api/audit?companyId=...` shows `permission.modified` and `role.changed`.
6. Attempting to include `company.delete` on a custom role is stripped.

## Next

**Phase 5 — Tests + docs** (persona architecture suite).
