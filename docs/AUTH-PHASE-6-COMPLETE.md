# Phase 6 complete — Security notifications + event subset

**Date:** 2026-08-21  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

### Queued security notifications (email channel)

| Event | When |
|-------|------|
| `security.login` | Successful sign-in (including after MFA / enroll) |
| `security.password_changed` | Change-password, reset, or admin password set |
| `security.role_changed` | Role / custom role update |
| `security.mfa_disabled` | User disables authenticator |
| `security.invite_accepted` | Staff or driver invite completed |
| `security.lockout` | Failed-login threshold lockout |

Delivery: `POST` to notification-service `/notifications/log` with `meta.category=security`. If `NOTIFICATION_SERVICE_URL` is unset, events are still **persisted** and logged locally.

### Security event store (`auth_db.SecurityEvent`)

First-class subset (not SIEM / impossible-travel): type, severity, message, IP, UA, meta.

| API | Access |
|-----|--------|
| `GET /auth/security-events` | Own events |
| `GET /auth/security-events?scope=company` | `users.view` / `admin.security` / owner |
| `POST /internal/security-events` | Service-to-service (invite accept) |

### Tenant notification rules

SQL `008_security_notifications.sql` seeds `NotificationRule` rows for each `security.*` event (email → user). Applied on provision, Security/Notifications load, and schema-migrate-all.

### UI

- Company → **Security**: Security events list + copy
- Company → **Notifications**: notes that security rules are included

### Local apply

```bash
cd backend/services/auth-service && npx prisma migrate deploy && npx prisma generate
cd backend/services/company-service && node scripts/copy-sql-assets.js
# existing tenants: open Notifications or Security once, or schema-migrate-all
```

Restart **auth**, **company**, **driver**, **gateway** (and notification-service if used).

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: sign in → Security events shows `login`; fail password until lockout → `lockout` event; change role → `role_changed` queued.

## What Phase 6 does *not* do

- Impossible travel / geo anomaly product
- Real SMTP delivery (still **queue**)
- Full Chapter 4.20 audit matrix expansion

## Next

Chapter 4 is **complete**. See [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md).
