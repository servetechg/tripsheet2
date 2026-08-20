# Phase 2 complete — Enforce + UI

**Date:** 2026-08-19  
**Parent:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)

## What shipped

Permissions from Phase 1 are now **enforced**. UI hiding is extra, not the only control.

### Gateway

- After JWT tenant resolution, a permission gate maps `method + path` → catalog codes.
- **Super Admin** bypasses in-tenant gates; **platform** routes (`POST /companies`, `/tenants`, toggle-active) stay Super Admin only.
- **Company Owner** (and legacy `company_admin`) keeps full in-tenant access, including JWTs minted without `permissions[]`.
- Everyone else: deny by default. Accountant `GET /api/loads` is allowed (`dispatch.view`); `PATCH /api/loads` is **403**.
- Mutating `/api/loads` without permission writes `AuditEvent.action = rbac.deny` (entity `dispatch`) on the company-service audit log.

Trusted headers forwarded to services: `x-user-permissions`, `x-driver-id`.

### Services

- **fleet-service loads:** create/edit/status/delete check the matching dispatch permission and audit deny; drivers only see/update their own loads (`x-driver-id` from login).
- **driver-service:** wage fields redacted without `drivers.wage.view`; contract write requires `drivers.wage.edit`; drivers scoped to own documents/contracts.
- **auth-service:** `POST /auth/users` requires `users.create` (+ `users.assign_role` for non-driver roles). JWT includes `driverId` for drivers.

### UI

- Staff roles (dispatcher, accountant, …) use `/app` with **tabs and actions filtered by permission**.
- Dispatch: no assign/edit/delete for view-only (accountant).
- Drivers: invite/add/wage hidden without the matching codes.
- **Users** tab: invite staff (dispatcher, accountant, …) by email. Completing `/invite` creates that role only.

### Staff invite (2.10 #1)

`POST /api/invites` with `{ kind: 'staff', role: 'dispatcher', email, name }` (needs `users.create` + `users.assign_role`). Completing the link creates an auth user with that role — not a driver record. An email notification is **queued** (`NotificationLog`, channel `email`) with the link. SMTP is not in this phase; the UI also shows the link to copy.

## What Phase 2 does *not* do

- Custom tenant roles (Phase 3)
- Password policy / lockout / MFA (Phase 4)
- Full architecture live suite for every persona (optional `npm run test:rbac` in gateway covers the matcher)

## Local apply

```bash
cd backend/shared/tenant-runtime && npm run build
cd backend/services/driver-service && npx prisma migrate deploy && npx prisma generate
```

Restart **gateway**, **auth-service**, **fleet-service**, **driver-service**, **notification-service**, and the frontend. Re-login so JWTs include `permissions` (and `driverId` for drivers).

Set `DRIVER_SERVICE_URL=http://localhost:3003` on auth-service (driver record id on JWT). Optional: `NOTIFICATION_SERVICE_URL` and `INVITE_PUBLIC_ORIGIN` on driver-service.

## How to verify

1. `cd backend/gateway && npm run test:rbac`
2. Login as company owner — every tab still visible; assign load still works.
3. Invite a dispatcher from **Users**; complete the link; login — Dispatch visible, Accounting hidden, wage actions hidden.
4. Invite an accountant; login — Dispatch visible read-only; **Assign Load** hidden.
5. As accountant, `PATCH /api/loads/:id` → **403**; `GET /api/audit` as owner shows `rbac.deny`.
6. Driver login — only own loads and documents.

## Next

**Phase 4 — Auth hardening** (password policy, lockout, `tokenVersion`).
