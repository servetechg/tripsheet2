# Phase 1 complete — Account status + auth gates

**Date:** 2026-08-20  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

Chapter 4 account **lifecycle status** is now a first-class field on `auth_db.User`. Only **active** users may authenticate. Suspend / reactivate / archive are admin actions that revoke sessions via `tokenVersion`.

### Status model

| Status | May log in? | Notes |
|--------|-------------|--------|
| `active` | Yes | Default for existing and newly created users |
| `pending` / `invited` | No | Reserved for Phase 2 invite activation |
| `inactive` | No | Soft disable without suspend semantics |
| `suspended` | No | Sets `suspendedAt`; sessions revoked |
| `locked` | No | Admin lock (separate from temporary `lockedUntil` lockout) |
| `archived` | No | Soft delete: `archivedAt` + `deletedAt`; **never hard-delete** |

Temporary failed-login lockout still uses `lockedUntil` without changing `status`.

### Enforcement

- **Login** — non-`active` → 401 + `LoginEvent` reason `status_*` + audit `login.denied`
- **Auth JWT guard** — rejects non-active on `/auth/*`
- **Gateway** — session snapshot includes `status` / `authAllowed`; blocks API calls for suspended/archived/etc.
- **Role change** — bumps `tokenVersion` (force re-login) + existing `role.changed` audit
- **Status change** — bumps `tokenVersion` + audit `user.status_changed`

### APIs / UI

- `PATCH /api/auth/users/:id` with `{ status }` requires `users.suspend` (plus existing edit/assign rules)
- `GET /api/auth/users` hides `archived` unless `?includeArchived=true`
- Company → Users: status pill; Suspend / Reactivate / Archive (soft)

Guards: cannot suspend/lock/archive yourself; only Super Admin can change another Super Admin’s status.

### Local apply

```bash
cd backend/services/auth-service
npx prisma migrate deploy
npx prisma generate
```

Restart **auth-service** and **gateway**. Re-login after status changes.

### How to verify

```bash
cd backend && npm run test:rbac
# includes auth user-lifecycle checks
```

Manual:

1. Owner suspends a dispatcher → that user cannot log in (“Account suspended”).
2. Existing JWT for that user fails on API calls after session cache refresh.
3. Reactivate → login works again.
4. Archive → user disappears from default Users list; login denied.
5. Change a user’s role → they must sign in again (`tv` bump).

## What Phase 1 does *not* do

- Invite expiry / pending→active (Phase 2)
- Forgot password (Phase 2–3)
- Password history / Chapter 4 complexity defaults (Phase 3)
- Refresh tokens / device list (Phase 4)
- Real TOTP MFA (Phase 5)

## Next

Phase 2 — invitation lifecycle + forgot-password (see [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)).
