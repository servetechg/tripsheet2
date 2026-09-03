# Phase 4 complete — Auth hardening

**Date:** 2026-08-19  
**Parent:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)

## What shipped

Login and password handling now follow the tenant **SecurityPolicy**. Existing seed passwords (`admin123`, `mkx123`, …) **still log in** until the user (or an admin) sets a new password. MFA is **not** a second factor in this release.

### Password policy (new / changed passwords only)

Tenant `company_local.SecurityPolicy`:

| Field | Default | Effect |
|--------|---------|--------|
| `passwordMinLength` | 8 | Floor for new passwords |
| `passwordComplexity` | false | When on: min **12** and upper + lower + digit |
| `sessionDays` | 7 | JWT `expiresIn` |
| `lockoutThreshold` / `lockoutMinutes` | 5 / 15 | Failed logins then lock |
| `idleTimeoutMinutes` | 0 (off) | Client idle logout |
| `requireMfa` | false | **Stored only.** Login is never blocked for MFA. |

Enforced on create user, invite complete, change password, and admin reset. Login does **not** reject old hashes that would fail the new rules.

### Lockout + login history (`auth_db`)

- `User.failedLoginCount`, `User.lockedUntil`
- `LoginEvent` rows (success / bad password / lockout)
- Company **Security** tab lists recent events
- Audit: `login.success`, `login.lockout`

Unknown emails still return **Invalid email or password** (no lockout leak for missing users).

### Forced logout (`tokenVersion`)

- JWT includes `tv`
- Password change and **Sign out all sessions** increment `tokenVersion`
- Gateway caches `GET /internal/users/:id/session` (~10s TTL) and rejects stale `tv`
- Auth-service JWT guard does the same on `/auth/*`

Stale tokens fail with **Token revoked. Sign in again.** Delay after revoke is at most the session cache TTL while auth-service is up.

### Session timeout

- JWT lifetime = tenant `sessionDays` (platform default 7)
- Idle timeout is **client-side** from `session.idleTimeoutMinutes` (login / `/auth/me`)

### MFA

`requireMfa` remains a policy flag for a future TOTP release. It does not block login and does not enroll a factor. Do not treat the checkbox as real MFA.

## APIs

- `POST /auth/login` — lockout, history, JWT `tv` + session expiry  
- `POST /auth/change-password` — policy + bump `tv` + new access token  
- `POST /auth/logout-all` — bump `tv`  
- `GET /auth/login-history` — self; `?scope=company` needs `admin.security`  
- `GET /internal/users/:id/session` — gateway  
- `GET /internal/tenants/:id/security-policy` — auth + invites  

## What Phase 4 does *not* do

- TOTP / SMS OTP / SSO / SAML  
- Refresh tokens, concurrent device caps, password history of N hashes  
- Server-enforced idle (JWT is still valid until expiry or `tv` bump)

## Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/company-service && npm run build
# existing tenants: first Security policy GET applies 004_auth_hardening.sql
# or Super Admin POST /api/tenants/schema-migrate-all
```

Restart **gateway**, **auth-service**, **company-service**, **driver-service**, and the frontend. Re-login so JWTs include `tv`.

## How to verify

1. `cd backend/services/auth-service && npm run test:auth`
2. `cd backend/gateway && npm run test:rbac`
3. Login as owner with `admin123` still works.
4. Enable complexity on Security → change password to `admin123` → rejected; `Admin1234xx` accepted; old JWT no longer works on API calls.
5. Five bad passwords → locked message; wait or wait for `lockedUntil`.
6. Security tab shows login history.
7. Require MFA checked → login still succeeds.

## Next

Chapter 2 RBAC is **complete**. See [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md).
