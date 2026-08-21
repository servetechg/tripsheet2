# Phase 3 complete — Chapter 4 password policy

**Date:** 2026-08-20  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

### Complexity (when `passwordComplexity` is on)

| Rule | Behavior |
|------|----------|
| Min length | Floor **12** (even if tenant min is lower) |
| Upper / lower / digit | Required |
| Special character | Required (`[^A-Za-z0-9]`) |
| Name / email ban | Rejects passwords containing name parts or email local-part (≥3 chars) |

Applies to **new and changed** passwords only. Existing seed logins (e.g. `admin123`) keep working until the password is changed.

### Password history

| Item | Detail |
|------|--------|
| Storage | `auth_db.PasswordHistory` (bcrypt hashes only) |
| Default | Last **10** (tenant `SecurityPolicy.passwordHistoryCount`, 0–24) |
| Enforcement | Change password, reset password, admin set password |
| Prune | Keeps at most N prior hashes per user |

### Admin unlock

| Action | API |
|--------|-----|
| Unlock | `POST /api/auth/users/:id/unlock` (`users.suspend`) |
| Clears | `lockedUntil`, `failedLoginCount`; if `status=locked` → `active` (+ `tokenVersion`) |
| UI | Company → Users: **Lock**, **Unlock** (also for temporary lockout) |

### Tenant policy UI

Security tab: **Password history**, updated complexity label, migration-window copy for weak seed passwords.

### Schema / SQL

- Auth migration `20260820200000_password_history`
- Tenant SQL `007_password_policy.sql` (`passwordHistoryCount`)

### Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/company-service && node scripts/copy-sql-assets.js
# existing tenants: open Security tab once, or POST /api/tenants/schema-migrate-all
```

Restart **auth**, **company**, **gateway**, **driver** (invite hints).

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: enable complexity → set password without special / with name → rejected; change password twice to same → history reject; lock user → unlock → login works; temporary lockout → Unlock clears it.

## What Phase 3 does *not* do

- Force-reset campaign for all weak passwords (optional later)
- Refresh tokens / device sessions (Phase 4)
- Real TOTP MFA (Phase 5)

## Next

Phase 4 — Sessions & devices (refresh + Session table; keep `tokenVersion`).
