# FleetQuix — Chapter 4 Auth, Security & User Lifecycle Plan

**Document type:** Architecture Decision Record (ADR) + Implementation Plan  
**Status:** Chapter 4 complete (Phases 1–7)  
**Version:** 1.7.1  
**Date:** 2026-08-21  
**Source:** Client Chapter 4 — Authentication, Security & User Lifecycle (`converted 3.md`)  
**Depends on:**

- [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) (Phases 0–6 complete)
- [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md) / [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) (Phases 1–5 complete)

---

## 1. What the client is asking for

Chapter 4 is **not** another tenancy or RBAC project. Company isolation and persona permissions are already done. This chapter is **how users enter, stay secure, and leave** the system.

| Theme | Client requirement |
|--------|-------------------|
| Zero Trust | Every request authenticated, authorized, logged, validated; nothing trusted by default |
| User lifecycle | Invite → pending → verify → active → suspend / archive (never hard-delete) |
| Registration | Admin invite (staff) + driver onboarding invite with docs/contract |
| Invitations | Single-use, expiring, revocable, regenerable |
| Login v1 | Email + password only |
| Login later | OTP, Entra, Google, Apple, SAML, Okta, Auth0 |
| Passwords | Min 12, complexity, no name/email, history of last N (default 10) |
| MFA | Authenticator apps (TOTP); optional/required by role; SMS/FIDO2 later |
| Sessions | Tracked sessions, idle timeout, refresh tokens, logout all, remote logout, history |
| Devices | Trusted device list; remove / rename / trust / report |
| Recovery | Forgot password → secure link → reset → revoke sessions (+ MFA if enabled) |
| Account status | Pending, Invited, Active, Inactive, Suspended, Locked, Archived (soft delete) |
| Lockout | After N failures → temporary lock; auto unlock or admin unlock |
| Role change | Update permissions, invalidate sessions, force re-login, audit |
| Security events | Failed logins, impossible travel, privilege escalation, API abuse, … |
| API auth | JWT + refresh; OAuth2 / API keys / webhooks / rate limits later |
| Mobile | Biometric, encrypted storage, offline validation, auto refresh (later / mobile track) |
| Notifications | New login, password/role/MFA/device/invite events |
| Audit | Immutable auth events with UTC, company, user, device, IP, success/failure |

**Acceptance (Chapter 4.22)**

1. **Invitation** — Admin sends invite → recipient opens link → creates account **once** before expiry.  
2. **Login** — Valid email/password → secure session created **and** audit-logged.  
3. **Password reset** — Successful reset → **all** existing sessions revoked → must log in again.  
4. **Suspended user** — Login denied and attempt logged.

---

## 2. Current state (baseline after multi-tenant + RBAC)

| Area | Today |
|------|--------|
| Tenancy | JWT `companyId` / `tenantKey`; gateway resolves `fq_tenant_*`; rule 10 largely met |
| RBAC | Gateway + service permission gates; custom roles; Chapter 2.10 proven |
| Login | Email + password only; JWT access token (`tv` = `tokenVersion`) |
| Password | Tenant `SecurityPolicy`: min length (default **8**); complexity adds Chapter 4 rules (12+, upper/lower/digit/special, name/email ban); history of last N (default **10**) on `PasswordHistory` — weak seeds still login until changed |
| Lockout | `failedLoginCount` + `lockedUntil`; threshold/minutes from policy (default 5 / 15) |
| MFA | Real TOTP enroll/challenge/disable + recovery codes; company `requireMfa` forces enroll at login |
| Sessions | Access JWT (short, default 15m) + refresh; `Session` rows; `tv` kill switch; idle on refresh (+ optional client) |
| Devices | List / rename / trust / remote revoke via User menu |
| Refresh tokens | Opaque refresh + `Session` rows (Phase 4) |
| Forgot password | `POST /auth/forgot-password` + `reset-password`; SHA-256 tokens; bumps `tokenVersion` |
| User status | Lifecycle enum on `User` (Phase 1): pending → invited → active → … |
| Invites | Expiry (`inviteTtlDays`), revoke, regenerate, single-use (Phase 2) |
| Soft delete | Soft archive only (`archived` + `deletedAt`); never hard-delete |
| Role change | Bumps `tokenVersion`, revokes sessions, security notify |
| Audit | `LoginEvent` + company `AuditEvent` + `SecurityEvent` subset (login, lockout, password, role, MFA, invite) |
| Notifications | Invite + reset + **security.*** events queued to notification-service |
| SSO / OTP / biometric | Explicitly deferred in RBAC ADR |

**Conclusion:** RBAC Phase 4 delivered a **partial** auth foundation (policy, lockout, `tv`, login history). Chapter 4 asks for a **full user lifecycle + enterprise session/MFA/recovery** story. Do **not** reopen tenancy or the RBAC permission catalog.

---

## 3. Architecture decisions (lock these)

### 3.1 Chapter 4 extends auth — it does not replace RBAC or tenancy

| Concern | Owner |
|---------|--------|
| Which company DB | Multi-tenant (done) |
| Who may do what inside a company | RBAC (done) |
| Who may log in, how, and with what session | **Chapter 4** |

Gateway still: JWT → tenant resolve → permission gate. Chapter 4 adds **status / MFA / session / recovery** checks **before or with** those layers.

### 3.2 Users and credentials stay on shared `auth_db`

| Data | Store | Why |
|------|--------|-----|
| User identity, hash, status, lockout, `tokenVersion`, MFA secrets | Shared **`auth_db`** | Same as RBAC; login is platform-wide |
| Password history hashes | **`auth_db`** | Not TMS operational data |
| Session / refresh / device registry | **`auth_db`** | Cross-service revoke must be central |
| Invite tokens (driver/staff) | Tenant **driver** schema (current) **or** migrate invites to `auth_db` if cross-cutting becomes painful | Prefer **keep invites where they are** in v1; harden fields in place |
| Security policy knobs | Tenant **`company_local.SecurityPolicy`** | Already exists; extend columns |
| Auth audit | Enrich **`LoginEvent`** + existing **`AuditEvent`** | Do not invent a third log store |

### 3.3 Soft delete / archive only (client 4.3 / 4.13 / rule 7)

- **Never** hard-delete users that have history.  
- Status `archived` (and soft `deletedAt` if useful) keeps reports and FK integrity.  
- Suspended / archived / locked ⇒ **cannot authenticate**.

### 3.4 MFA: ship real TOTP or keep flag — never fake MFA

Same rule as RBAC Phase 4. When Phase “MFA” ships:

- TOTP enroll + verify at login when policy/role requires it.  
- Until then, UI must not claim “MFA enabled.”

SMS OTP, email OTP, FIDO2 = **later**.

### 3.5 Login methods

| Method | Decision |
|--------|----------|
| Email + password | **v1 — keep / harden** |
| Mobile OTP, Entra, Google, Apple, SAML, Okta, Auth0 | **Deferred** (client §4.7 Future) — design JWT/`sub` stable for SSO later |
| Driver biometric / offline mobile | **Deferred** to mobile app track (client §4.18) |

### 3.6 Sessions: evolve from `tokenVersion` — do not throw it away

**v1 session model (recommended):**

```text
Login → Access JWT (short) + Refresh token (opaque, hashed in auth_db Session row)
         Session row: userId, device meta, ip, ua, createdAt, lastSeenAt, revokedAt
Logout / reset / role change / logout-all → revoke session(s) and/or bump tokenVersion
```

- Keep **`tokenVersion`** as a global “kill switch” (password reset, suspend, logout-all).  
- Add **per-device Session** rows for list / remote logout / history.  
- Idle timeout: prefer **refresh inactivity** + optional client idle; document that access JWT alone is short-lived.

### 3.7 Password policy alignment with Chapter 4

| Rule | Chapter 4 default | Our move |
|------|-------------------|----------|
| Min length | 12 | Raise **tenant default** to 12 when complexity/chapter-4 mode on; migration window for seed passwords |
| Upper / lower / digit | Required | Already when `passwordComplexity` |
| Special character | Required | **Add** when complexity on |
| Ban first/last/email | Required | **Add** |
| History of last 10 | Required | **Add** `PasswordHistory` (hashes only) |
| Existing `admin123` | — | Still login until user/admin changes (same RBAC rule) |

### 3.8 Invitations

Harden existing staff + driver invites:

- Configurable TTL (default **7 days**) on `SecurityPolicy` or invite row.  
- Single-use on complete.  
- Revoke + regenerate.  
- Status: `pending` / `completed` / `expired` / `revoked`.  
- Users **cannot log in** until invite completed (rule 1) — implies pending invitees are not active users with passwords, or status=`pending`/`invited`.

Driver HR approval before activation (rule 2): align with existing driver approve flow; block login until approved if that is product truth — **confirm in Phase 0 lock-in** against current driver status fields.

### 3.9 Rejected / deferred (say no unless you reopen)

| Item | Decision |
|------|----------|
| Full SSO (Entra/Google/SAML/Okta/Auth0) | **Deferred** (§4.7 Future) |
| SMS / email OTP MFA | **Deferred** |
| FIDO2 / WebAuthn | **Deferred** |
| Impossible travel / geo anomaly ML | **Deferred** (log IP/UA first; alerting later) |
| API OAuth2 + webhook secrets + rate limiting product | **Deferred** (tenant API keys already partial in org) |
| Mobile biometric / offline session | **Deferred** (mobile track) |
| Hard delete users | **No** |
| Replacing RBAC permissions with “auth roles” | **No** |
| Putting passwords in tenant DB | **No** |

---

## 4. Gap map (Chapter 4 section → plan) — closed

Historical planning map. **Outcome:** all in-scope rows delivered in Phases 1–7; deferred rows stay deferred (see [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)).

| § | Topic | Outcome |
|---|--------|---------|
| 4.3 | Lifecycle | **Done** (Phase 1) — status machine; only `active` authenticates |
| 4.4–4.6 | Invites | **Done** (Phase 2) — TTL, revoke, regenerate, single-use |
| 4.5 | Driver invite | **Done** (Phase 2 harden) |
| 4.7 | Login methods | Email/password **done**; SSO deferred |
| 4.8 | Password policy | **Done** (Phase 3) — complexity + history |
| 4.9 | MFA TOTP | **Done** (Phase 5) — real TOTP + recovery |
| 4.10 | Sessions | **Done** (Phase 4) — short access + refresh `Session` |
| 4.11 | Devices | **Done** (Phase 4) — list / rename / trust / revoke |
| 4.12 | Forgot password | **Done** (Phase 2) |
| 4.13–4.14 | Status + lockout | **Done** (Phases 1 + existing lockout) |
| 4.15 | Role change revoke | **Done** — `tv` bump + session revoke + notify |
| 4.16 | Security events | **Done** (Phase 6 subset; not impossible-travel) |
| 4.17 | API JWT/refresh | **Done** (Phase 4) |
| 4.18 | Mobile | Deferred |
| 4.19 | Security notifications | **Done** (Phase 6 queue) |
| 4.20 | Audit completeness | **Done** for Chapter 4 scope (`LoginEvent` + audit + `SecurityEvent`) |
| 4.21–4.22 | Rules + acceptance | **Proven** (Phase 7) |

---

## 5. Proposed data model (auth_db additions)

Conceptual — exact Prisma in implementation:

```text
User
  + status: pending | invited | active | inactive | suspended | locked | archived
  + emailVerifiedAt?
  + phoneVerifiedAt?          // optional; phone verify may stay deferred
  + suspendedAt / archivedAt?
  + deletedAt?                // soft only
  + mfaEnabled / mfaSecretEnc? // Phase 5

PasswordHistory
  userId, passwordHash, createdAt

Session
  id, userId, refreshTokenHash, userAgent, ip, deviceLabel?
  createdAt, lastSeenAt, revokedAt, revokeReason?

MfaRecoveryCode (Phase 5)
  userId, codeHash, usedAt?
```

Extend tenant `SecurityPolicy`:

- `inviteTtlDays` (default 7)  
- `passwordHistoryCount` (default 10)  
- `passwordRequireSpecial` (or fold into complexity = Chapter 4 full rules)  
- `refreshIdleMinutes` / keep `idleTimeoutMinutes`  
- `requireMfa` + optional `mfaRequiredRoles[]` later  

---

## 6. Implementation phases

Same cadence as tenancy / RBAC: lock-in → vertical slices → tests → stop.

### Phase 0 — Design lock-in (this document)

- [x] Agree gap map and deferred list (SSO, mobile biometric, impossible travel, FIDO2)  
- [x] Agree soft-delete / status enum values  
- [x] Agree session model: refresh + Session table + keep `tokenVersion`  
- [x] Agree MFA = real TOTP in Phase 5 (not fake)  
- [x] Confirm driver “HR approve before login” against current driver statuses — **deferred detail to Phase 2** (status `pending`/`invited` reserved; driver approve gate stays as-is until invite harden)

### Phase 1 — Account status + auth gates

- [x] `User.status` (+ soft archive fields)  
- [x] Login / JWT reject: suspended, archived, inactive (as defined), locked  
- [x] Admin suspend / reactivate / archive APIs + UI  
- [x] Role change → bump `tokenVersion` + audit `role.changed` (already partial)  
- [x] Audit: login denied for status  

See [AUTH-PHASE-1-COMPLETE.md](./AUTH-PHASE-1-COMPLETE.md).

### Phase 2 — Invitation lifecycle + forgot-password start

- [x] Invite expiry (default 7d), revoke, regenerate; single-use enforced  
- [x] Staff + driver flows meet acceptance #1  
- [x] Block login until invite accepted (rule 1)  
- [x] `POST /auth/forgot-password` + token email (queued) + reset page  
- [x] Reset bumps `tokenVersion` / revokes sessions (acceptance #3)  

See [AUTH-PHASE-2-COMPLETE.md](./AUTH-PHASE-2-COMPLETE.md).

### Phase 3 — Password policy Chapter 4

- [x] Complexity: special char + ban name/email substrings  
- [x] Password history (default last 10 hashes)  
- [x] Align defaults documentation; migration window for weak seed passwords  
- [x] Admin unlock for locked accounts  

See [AUTH-PHASE-3-COMPLETE.md](./AUTH-PHASE-3-COMPLETE.md).

### Phase 4 — Sessions & devices

- [x] `Session` (+ refresh token) issue on login  
- [x] Refresh endpoint; revoke on logout / logout-all / reset  
- [x] List sessions/devices; remote revoke one device  
- [x] Session history from Session + LoginEvent  
- [x] Document idle = refresh inactivity (+ optional client idle)  

See [AUTH-PHASE-4-COMPLETE.md](./AUTH-PHASE-4-COMPLETE.md).

### Phase 5 — TOTP MFA

- [x] Enroll / verify / disable with password confirm  
- [x] Honor `requireMfa` (and optional role list) at login  
- [x] Recovery codes  
- [x] Audit MFA enable/disable; revoke sessions on disable if required  

See [AUTH-PHASE-5-COMPLETE.md](./AUTH-PHASE-5-COMPLETE.md).

### Phase 6 — Security notifications + event subset

- [x] Notify (queue): new login, password changed, role changed, MFA disabled, invite accepted  
- [x] Security event hooks for brute force (reuse lockout), privilege change  
- [x] **Not** full impossible-travel product in this phase  

See [AUTH-PHASE-6-COMPLETE.md](./AUTH-PHASE-6-COMPLETE.md).

### Phase 7 — Tests + docs

- [x] Architecture suite covering 4.22 (invite once, login+audit, reset revokes, suspended denied)  
- [x] ADR complete note `AUTH-CHAPTER-4-COMPLETE.md`  
- [x] Update Security UI copy so MFA/SSO claims match reality after each phase  

See [AUTH-PHASE-7-COMPLETE.md](./AUTH-PHASE-7-COMPLETE.md) and [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md).

---

## 7. UI / product shape

- **Security** tab: extend policy (invite TTL, history, MFA, session idle).  
- **Users**: status badges; suspend / archive / unlock; invite revoke/resend.  
- **Account / User menu**: sessions & devices; change password; MFA enroll (Phase 5).  
- **Public**: forgot-password + invite complete (existing) + MFA challenge page.  
- **Super Admin**: unchanged platform ops; no Chapter 4 SSO admin unless later.

---

## 8. Risks (resolved / remaining)

| Risk | Status |
|------|--------|
| Breaking seed logins with min-12 default | Mitigated — policy on **new/changed** passwords |
| Fake MFA checkbox confusion | Resolved — Phase 5 ships real TOTP |
| Refresh token theft | Mitigated — hashed refresh, rotate, short access TTL |
| Invite in tenant DB vs auth_db split | Accepted — hardened in place |
| Scope creep (SSO + mobile + geo) | Deferred — see COMPLETE ADR |
| Overlap with RBAC Phase 4 | Accepted — Chapter 4 continues; no duplicate lockout product |

---

## 9. Exit criteria for **planning** (this step)

- [x] ADR written from Chapter 4 vs current multi-tenant + RBAC baseline  
- [x] Lock-in confirmed (status enum, session model, TOTP-not-fake, deferred SSO/mobile/geo)  
- [x] Phases 1–7 accepted as implementation order  
- [x] Phase 1 implemented — see [AUTH-PHASE-1-COMPLETE.md](./AUTH-PHASE-1-COMPLETE.md)  
- [x] Phase 2 implemented — see [AUTH-PHASE-2-COMPLETE.md](./AUTH-PHASE-2-COMPLETE.md)  
- [x] Phase 3 implemented — see [AUTH-PHASE-3-COMPLETE.md](./AUTH-PHASE-3-COMPLETE.md)  
- [x] Phase 4 implemented — see [AUTH-PHASE-4-COMPLETE.md](./AUTH-PHASE-4-COMPLETE.md)  
- [x] Phase 5 implemented — see [AUTH-PHASE-5-COMPLETE.md](./AUTH-PHASE-5-COMPLETE.md)  
- [x] Phase 6 implemented — see [AUTH-PHASE-6-COMPLETE.md](./AUTH-PHASE-6-COMPLETE.md)  
- [x] Phase 7 implemented — see [AUTH-PHASE-7-COMPLETE.md](./AUTH-PHASE-7-COMPLETE.md) + [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)  
- [x] Chapter 4 closed for this ADR scope

---

## 10. Out of scope (unchanged after close-out)

Still deferred (see [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)):

- SSO providers (Entra / Google / SAML / …)  
- SMS OTP, FIDO2/WebAuthn  
- Mobile biometric / offline vault  
- Impossible-travel / full SIEM  
- Real SMTP (notifications remain queued)  
- Reopening RBAC catalogs or multi-tenant architecture  

---

## 11. Implementation order (completed)

Phases **1 → 7** shipped in order. No further Phase N work under this ADR unless the ADR is reopened.

---

## Related docs

- [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md) — Chapter 4 close-out ADR  
- [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) — permission model (done)  
- [RBAC-PHASE-4-COMPLETE.md](./RBAC-PHASE-4-COMPLETE.md) — partial auth hardening already shipped  
- [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) — company isolation (done)
