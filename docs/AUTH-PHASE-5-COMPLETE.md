# Phase 5 complete — TOTP MFA

**Date:** 2026-08-21  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)

## What shipped

### Real TOTP (not a fake flag)

| Piece | Detail |
|-------|--------|
| Algorithm | RFC 6238 HMAC-SHA1, 30s, 6 digits (in-process — no OTP SaaS) |
| Secret storage | AES-256-GCM blob on `User.mfaSecretEnc` (`MFA_ENCRYPTION_KEY` or `JWT_SECRET`) |
| Recovery | 10 one-time codes in `MfaRecoveryCode` (SHA-256 hashes) |
| QR | `otpauth://` + PNG data URL via `qrcode` |

### Login behavior

| Condition | Result |
|-----------|--------|
| `mfaEnabled` | Password OK → `mfaRequired` + short `mfaToken` → `POST /auth/mfa/challenge` |
| Company `requireMfa` and not enrolled | Password OK → forced enroll (`enroll-login/start` + `confirm`) then session |
| Neither | Session issued as before |

Success `LoginEvent` is recorded **after** MFA (or enroll) completes.

### Authenticated APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /auth/mfa/status` | Enabled + recovery remaining + company require |
| `POST /auth/mfa/enroll/start` | Secret + QR |
| `POST /auth/mfa/enroll/confirm` | Enable + return recovery codes once |
| `POST /auth/mfa/disable` | Password + TOTP/recovery; bumps `tv`; **revokes all sessions** |
| `POST /auth/mfa/recovery/regenerate` | Password + code → new recovery set |

### UI

- Login: MFA challenge + company-required enroll flow
- User menu → **Authenticator (MFA)** enroll / disable / regenerate
- Security tab: “Require MFA (authenticator at login)”

### Local apply

```bash
cd backend/services/auth-service
npx prisma migrate deploy
npx prisma generate
# optional: MFA_ENCRYPTION_KEY=<long random> in .env
```

Restart **auth** and **gateway**.

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: enable MFA → logout → login prompts for code; wrong code fails; recovery code works once; disable MFA signs out everywhere; turn on company Require MFA → user without MFA must enroll at next login.

## What Phase 5 does *not* do

- SMS / email OTP / FIDO2 (deferred)
- Per-role `mfaRequiredRoles[]` (optional later; company-wide `requireMfa` ships)
- Security notification emails (Phase 6)

## Next

Phase 6 — security notifications + event subset.
