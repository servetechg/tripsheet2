# Phase 4 complete — Sessions & devices

**Date:** 2026-08-21  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

### Session model (`auth_db.Session`)

| Field | Role |
|-------|------|
| `refreshTokenHash` | SHA-256 of opaque refresh (rotated on use) |
| `userAgent` / `ip` / `deviceLabel` / `trusted` | Device registry |
| `createdAt` / `lastSeenAt` / `expiresAt` | Lifetime + refresh idle |
| `revokedAt` / `revokeReason` | Remote logout / idle / password / account change |

`tokenVersion` remains the global kill switch. JWT access tokens now include `sid` and are **short-lived** (`ACCESS_TOKEN_MINUTES`, default **15**). Refresh lifetime follows tenant `sessionDays`.

### APIs

| Endpoint | Behavior |
|----------|----------|
| `POST /auth/login` | Access + refresh + `Session` row |
| `POST /auth/refresh` | Rotate refresh; reject if revoked/expired/idle |
| `POST /auth/logout` | Revoke current session (refresh or `sid`) |
| `POST /auth/logout-all` | Bump `tv` + revoke all sessions |
| `GET /auth/sessions` | List devices (marks `current`) |
| `GET /auth/sessions/history` | Sessions + recent `LoginEvent`s + idle note |
| `PATCH /auth/sessions/:id` | Rename / trust |
| `POST /auth/sessions/:id/revoke` | Remote sign-out one device |

Password reset / change, role change, and status changes revoke sessions (and bump `tv` where already required).

### Gateway

- Public: `/api/auth/refresh`
- Session snapshot supports `?sid=` so revoked devices fail after cache TTL

### UI

- Login / change-password store refresh token (`ts_refresh`)
- `api()` retries once via refresh on 401
- User menu → **Sessions & devices** (rename, trust, remote revoke, login history)
- Security tab copy documents short access + refresh idle

### Idle model

1. **Server:** refresh rejected if `lastSeenAt` older than `idleTimeoutMinutes`  
2. **Client:** optional browser idle timer (unchanged UX)  
3. Access JWT alone is short; do not treat `sessionDays` as access TTL anymore

### Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
# restart auth + gateway
# optional: ACCESS_TOKEN_MINUTES=15 in auth-service .env
```

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: login → see session in menu → revoke another device after second login → refresh rotates; logout-all invalidates all; wait past access TTL and confirm silent refresh.

## What Phase 4 does *not* do

- Real TOTP MFA (Phase 5)
- Security notification product emails (Phase 6)
- Impossible travel / geo ML

## Next

Phase 5 — TOTP MFA (enroll / verify / honor `requireMfa`).
