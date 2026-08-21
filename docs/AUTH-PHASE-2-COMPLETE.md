# Phase 2 complete — Invitation lifecycle + forgot password

**Date:** 2026-08-20  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

### Invitations (staff + driver)

| Capability | Behavior |
|------------|----------|
| Expiry | `expiresAt` set from tenant `SecurityPolicy.inviteTtlDays` (default **7**) |
| Single-use | Complete only while `status=pending`; then `completed` |
| Lazy expire | `findByToken` / `complete` / `list` mark past-due invites `expired` |
| Revoke | `POST /api/invites/:id/revoke` → `revoked` |
| Regenerate | `POST /api/invites/:id/regenerate` revokes pending original and issues a new token |
| Email | Queued via notification-service when email is present (staff + driver) |

Users are still **created only on invite complete** (rule 1: cannot log in until accepted). Direct admin `POST /auth/users` remains for owners who create accounts without invite.

### Forgot / reset password

| Step | API |
|------|-----|
| Request | `POST /api/auth/forgot-password` `{ email }` — always `{ ok: true }` (no enumeration) |
| Reset | `POST /api/auth/reset-password` `{ token, newPassword }` |
| Sessions | Reset bumps `tokenVersion` (all JWTs revoked) |
| Storage | `PasswordResetToken` on `auth_db` (SHA-256 of raw token, 1h TTL, single-use) |
| Local | If `NOTIFICATION_SERVICE_URL` unset, response includes `resetUrl` for copy/paste |

Public gateway paths: login, forgot-password, reset-password, invite by-token/complete.

### UI

- Login → **Forgot password?** → `/forgot-password` → `/reset-password?token=…`
- Company → Users: pending invites with Revoke / Resend
- Security policy: **Invite link TTL (days)**

### Schema / SQL

- Auth migration `20260820180000_password_reset`
- Driver migration `20260820180000_invite_expiry`
- Tenant SQL `006_invite_lifecycle.sql` (`inviteTtlDays` + `Invite.expiresAt`)

### Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/driver-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/company-service && node scripts/copy-sql-assets.js
# existing tenants: open Security tab once, or POST /api/tenants/schema-migrate-all
```

Restart **auth**, **driver**, **company**, **gateway**.

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: create staff invite → complete once → second complete fails; wait/expire or revoke; forgot password → reset → old JWT rejected.

## What Phase 2 does *not* do

- Password history / special-char defaults (Phase 3)
- Refresh tokens / devices (Phase 4)
- Real TOTP MFA (Phase 5)
- SMTP delivery (still notification **queue**)

## Next

Phase 3 — Chapter 4 password policy (special char, name/email ban, history of N).
