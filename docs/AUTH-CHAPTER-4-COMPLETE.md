# Chapter 4 complete — Authentication & user lifecycle

**Document type:** Architecture Decision Record (close-out)  
**Date:** 2026-08-21  
**Plan:** [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md)  
**Depends on:** Multi-tenant DB-per-company; [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md)

Chapter 4 is **who may log in, how sessions work, and how accounts are recovered**. Tenancy and RBAC catalogs were already done. This close-out records what shipped (Phases 1–7) and what remains explicitly out of scope.

---

## Lock-in (unchanged)

| Decision | v1 |
|----------|----|
| Users / passwords / MFA / sessions | Shared **`auth_db`** |
| Custom roles / security policy / invites | Tenant DBs (policy + invites hardened in place) |
| Soft delete | Archive only — never hard-delete users with history |
| Authenticate | Only **`active`** status |
| Global kill switch | `tokenVersion` (+ session revoke) |
| MFA | Real **TOTP** + recovery codes — never a fake checkbox |
| SSO / SMS OTP / FIDO2 / biometric / impossible-travel product | Deferred |

---

## What shipped

| Phase | Outcome |
|-------|---------|
| **1** | User status lifecycle; only `active` authenticates; suspend / archive / unlock |
| **2** | Invite TTL / revoke / regenerate / single-use; forgot + reset password |
| **3** | Password complexity + history; admin unlock |
| **4** | Short access JWT + refresh `Session` rows; devices UI; remote revoke |
| **5** | TOTP enroll/challenge; company `requireMfa`; recovery codes |
| **6** | Security notifications queue + `SecurityEvent` subset (login, lockout, password, role, MFA, invite) |
| **7** | §4.22 architecture suite + this ADR; Security UI copy matches reality |

Phase notes: [1](./AUTH-PHASE-1-COMPLETE.md) · [2](./AUTH-PHASE-2-COMPLETE.md) · [3](./AUTH-PHASE-3-COMPLETE.md) · [4](./AUTH-PHASE-4-COMPLETE.md) · [5](./AUTH-PHASE-5-COMPLETE.md) · [6](./AUTH-PHASE-6-COMPLETE.md) · [7](./AUTH-PHASE-7-COMPLETE.md)

---

## Chapter 4.22 acceptance

| # | Requirement | How we prove it |
|---|-------------|-----------------|
| 1 | Admin invite → recipient creates account **once** before expiry | Live: staff invite complete → second complete denied. In-process: invite status/expiry helpers. |
| 2 | Valid login → secure session **and** audit-logged | Live: access token + `/me` + `LoginEvent` success + `SecurityEvent`. In-process: active-only + notify/session contracts. |
| 3 | Successful password reset → **all** sessions revoked | Live: reset → prior JWT 401 → login with new password. In-process: `tv` bump + refresh hash contract. |
| 4 | Suspended user → login denied and attempt logged | Live: suspend → 401 + failed `LoginEvent`. In-process: `canAuthenticateStatus('suspended') === false`. |

---

## How to verify

In-process (always, no Docker):

```bash
cd backend && npm run test:rbac
```

Live (gateway + auth + company + driver):

```bash
cd backend
npm run test:auth:live          # ephemeral company, then deprovision
npm run test:auth:all           # in-process + live
# gateway:
npm run test:auth:live:keep
npm run test:auth:live:existing
```

---

## Explicitly not in Chapter 4

- Entra / Google / SAML SSO  
- SMS OTP, FIDO2/WebAuthn  
- Impossible-travel / full SIEM  
- Mobile biometric / offline token vault  
- Real SMTP (notifications remain **queued**)  
- Reopening RBAC permission catalog or multi-tenant architecture  

Those stay later chapters or a reopen of this ADR.
