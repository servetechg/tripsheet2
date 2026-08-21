# Phase 7 complete — Tests + docs

**Date:** 2026-08-21  
**Parent:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)  
**Close-out:** [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)

## What shipped

Chapter 4 is closed with an **architecture acceptance suite** for §4.22 plus the ADR close-out document. Security UI copy now states TOTP MFA is real and SSO is deferred.

### In-process (always)

| Command | Asserts |
|---------|---------|
| `cd backend && npm run test:rbac` | Includes `check-chapter4-acceptance.ts` — invite single-use/expiry, active-only login, reset/`tv` contract, suspended deny, security notify + TOTP helpers |
| `auth-service` `npm run test:auth:acceptance` | Same 4.22 contracts alone |

### Live suite

```bash
cd backend && npm run test:auth:live
# or: cd backend/gateway && npm run test:auth:live
```

Against a running stack (gateway + auth + company + driver):

1. Provisions ephemeral tenant (or `--existing` / `--keep`)
2. **4.22 #1** — staff invite → complete once → second complete denied → login works  
3. **4.22 #2** — login → `/me` → company `login-history` success + `security-events`  
4. **4.22 #3** — forgot/reset password → prior JWT **401** → login with new password  
5. **4.22 #4** — suspend user → login **401** + failed `LoginEvent`

Forgot-password may return `resetUrl` when `NOTIFICATION_SERVICE_URL` is unset, `NODE_ENV=test`, or `AUTH_EXPOSE_RESET_URL=1` (local/architecture runs). Production with a notify URL and without that flag stays enumeration-safe.

### Docs / UI

- [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)  
- Company → Security: MFA = TOTP; SSO explicitly not in this release  

## How to verify

```bash
cd backend && npm run test:rbac          # in-process (includes 4.22 contracts)
cd backend && npm run test:auth:live     # live 4.22 (stack up)
cd backend && npm run test:auth:all      # both
```

## What Phase 7 does *not* do

- Browser UI automation  
- Impossible-travel product tests  
- SSO / SMS OTP / FIDO2
