# Chapter 4 — Authentication & User Lifecycle: Full Testing Guide

**Version:** 1.0  
**Date:** 2026-08-29  
**Scope:** Login, sessions, invites, password policy, MFA, security events, account lifecycle (Phases 1–7).

Related: [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md) · [AUTH-CHAPTER-4-PLAN.md](./AUTH-CHAPTER-4-PLAN.md) · [RBAC-TESTING-GUIDE.md](./RBAC-TESTING-GUIDE.md)

---

## 1. Before you start

### 1.1 Start the stack

```powershell
cd C:\other-projects\tripsheet\backend
npm run infra:up          # postgres + redis (if not already up)
npm run start:dev         # gateway + all microservices
```

In a second terminal:

```powershell
cd C:\other-projects\tripsheet\frontend
npm run dev
```

**Verify:** `http://localhost:3000/health` returns OK. Auth-service on `:3001` must respond.

### 1.2 Apply migrations (once per environment)

```powershell
cd C:\other-projects\tripsheet\backend\services\auth-service
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

For **tenant companies** (MKX), security policy and staff invites live on the tenant DB. After deploy:

```http
POST http://localhost:3000/api/tenants/schema-migrate-all
Authorization: Bearer <super-admin-token>
```

Tenant SQL includes invite lifecycle (`006_invite_lifecycle.sql`) and security notifications.

### 1.3 Test accounts (seeded)

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| Super Admin | `admin@tripsheet.io` | `admin123` | Platform-only paths, tenant ops |
| MKX Owner | `admin@mkx.ca` | `mkx123` | Users, security policy, staff invites |
| MKX Driver | `divyam@mkx.ca` | `driver123` | Driver login, suspend test target |

---

## 2. Automated tests (run first)

### 2.1 In-process (no Docker, no UI)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:rbac
```

Auth-related contracts are included in the gateway RBAC gate script and auth-service / company-service / driver-service RBAC unit scripts (active-only login, public auth paths, invite permissions).

Driver-service invite TTL helpers:

```powershell
cd C:\other-projects\tripsheet\backend\services\driver-service
npm run test:rbac
```

### 2.2 Live gateway acceptance (Chapter 4.22)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:auth:live
```

**Requires:** Gateway `:3000`, auth, company, driver (+ notification optional).

**Optional env:**

```powershell
$env:SUPERADMIN_EMAIL = "admin@tripsheet.io"
$env:SUPERADMIN_PASSWORD = "admin123"
# Use existing MKX instead of ephemeral company:
npm run test:auth:live:existing --prefix gateway
```

**What it proves live:**

| # | Requirement | Suite |
|---|-------------|-------|
| 1 | Staff invite → complete once → second complete denied | §2 |
| 2 | Valid login → access token + `/me` + login history + security event | §3 |
| 3 | Password reset → prior JWT rejected | §4 |
| 4 | Suspended user → login denied + failed login history | §5 |
| 5 | Driver invite → onboarding → login; suspend blocks auth | §6 |

**Keep fixtures for debugging:**

```powershell
cd backend\gateway
npm run test:auth:live:keep
```

### 2.3 Full auth bundle

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:auth:all    # in-process RBAC + live Chapter 4.22
```

---

## 3. Manual UI testing — by feature

App: `http://localhost:5173`. Use incognito for invite / reset flows.

### Phase 1 — User status lifecycle

| # | Steps | Expected result |
|---|--------|-----------------|
| 1.1 | Login as `admin@mkx.ca` | Workspace loads |
| 1.2 | Company → **Users** → suspend a test staff user | User status suspended |
| 1.3 | Log out → login as suspended user | Login blocked with suspended message |
| 1.4 | Owner → **Unlock** or re-activate user | User can sign in again |
| 1.5 | Archive user (if exposed) | User cannot authenticate |

**Permissions:** `users.edit`, `users.suspend`

---

### Phase 2 — Invites & password recovery

| # | Steps | Expected result |
|---|--------|-----------------|
| 2.1 | Company → **Users** → staff invite (dispatcher + email) | Invite link generated (`/invite?invite=…`) |
| 2.2 | Open link in **incognito** → set password → complete | Account created; can sign in |
| 2.3 | Re-open same invite link | Error: already used / invalid |
| 2.4 | **Forgot password** (`/forgot-password`) → submit email | Success message (reset link in notification log in dev) |
| 2.5 | Open reset link → set new password | Password changed; can sign in |
| 2.6 | Try old password on another session | Old session rejected after reset |

**Driver invites:** Drivers tab → **Send invite link** uses the same public `/invite` route. For tenant-routed companies (MKX), the link must resolve against the tenant DB (fixed in driver-service `findByToken`).

**Staff vs driver invite:** Staff requires email + role; driver invite is token-only onboarding.

---

### Phase 3 — Password policy

| # | Steps | Expected result |
|---|--------|-----------------|
| 3.1 | Company → **Security** → set min length 12 + complexity ON → Save | Policy saved |
| 3.2 | Create user or reset password with weak password | Validation error with policy hint |
| 3.3 | Use compliant password | Succeeds |
| 3.4 | Change password to one matching a recent password (if history enabled) | Rejected |

---

### Phase 4 — Sessions & devices

| # | Steps | Expected result |
|---|--------|-----------------|
| 4.1 | Login on two browsers as same user | Both sessions work |
| 4.2 | User menu → **Sessions & devices** | Active sessions listed |
| 4.3 | Revoke one session | That browser gets 401 on next API call |
| 4.4 | **Sign out all devices** | All sessions invalidated; re-login required |

**API check:**

```http
GET /api/auth/sessions
Authorization: Bearer {token}
```

---

### Phase 5 — MFA (TOTP)

| # | Steps | Expected result |
|---|--------|-----------------|
| 5.1 | Company → **Security** → **Require MFA** ON → Save | Policy saved |
| 5.2 | Log out → login as staff user | MFA enrollment screen (QR + code) |
| 5.3 | Scan QR in authenticator app → enter code | Login completes |
| 5.4 | Log out → login again | MFA challenge (6-digit code) |
| 5.5 | Wrong code | Challenge rejected |
| 5.6 | Use recovery code (if enrolled) | Login succeeds; code consumed |

**Note:** MFA is real TOTP — not a checkbox-only flag.

---

### Phase 6 — Security events & notifications

| # | Steps | Expected result |
|---|--------|-----------------|
| 6.1 | Successful login | `security.login` event (Company → **Security** events list) |
| 6.2 | Failed login (wrong password) | Failed attempt in login history |
| 6.3 | Password reset | `security.password_reset` (or equivalent) |
| 6.4 | Staff invite accepted | `security.invite_accepted` |
| 6.5 | Role change on user | Security event with role detail |

---

### Phase 7 — Integration smoke

| # | Steps | Expected result |
|---|--------|-----------------|
| 7.1 | Driver invite → complete onboarding | Auth user + driver record created |
| 7.2 | Suspend driver from profile | Driver login blocked |
| 7.3 | Super admin login | No company workspace; platform admin only |

---

## 4. API reference (gateway `:3000`)

Public (no bearer):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Email + password (+ MFA step if required) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Queue reset email |
| POST | `/api/auth/reset-password` | Set new password (revokes sessions) |
| POST | `/api/auth/mfa/challenge` | Complete MFA at login |
| POST | `/api/auth/mfa/enroll-login/start` | Start MFA enrollment at login |
| POST | `/api/auth/mfa/enroll-login/confirm` | Confirm enrollment |
| GET | `/api/invites/by-token/:token` | Public invite lookup |
| POST | `/api/invites/:token/complete` | Complete invite (driver or staff) |

Authenticated:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Current user + permissions |
| GET | `/api/auth/sessions` | Active sessions |
| DELETE | `/api/auth/sessions/:id` | Revoke session |
| POST | `/api/auth/logout-all` | Revoke all sessions |
| POST | `/api/auth/users` | Create staff user (owner) |
| PATCH | `/api/auth/users/:id` | Suspend / unlock / role |
| GET | `/api/auth/login-history?scope=company&companyId=` | Login audit |
| GET | `/api/auth/security-events?scope=company&companyId=` | Security events |
| PATCH | `/api/companies/:id/security-policy` | Password + MFA policy |

### Example: password reset revokes old JWT

```powershell
# Login
$r = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" -Body '{"email":"USER@example.com","password":"OldPass9!X"}'
$oldToken = $r.accessToken

# Forgot + reset (use token from notification log in dev)
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/forgot-password" `
  -ContentType "application/json" -Body '{"email":"USER@example.com"}'

# After reset with new password:
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" -Headers @{ Authorization = "Bearer $oldToken" }
} catch {
  # Expect 401
}
```

---

## 5. Validation matrix (server rules)

| Rule | Enforced by | UI surface |
|------|-------------|------------|
| Only `active` users authenticate | auth-service | Login screen |
| Suspended / archived blocked | auth-service + session cache | Login |
| Short-lived access JWT + refresh rows | auth-service | Sessions panel |
| `tokenVersion` bump on reset / suspend | auth-service | Old tokens 401 |
| Invite single-use + TTL | driver-service invites | Invite route |
| Password complexity from tenant policy | auth + company security policy | Reset / create user |
| MFA required when company policy ON | auth MFA flow | LoginScreen |
| Public invite resolves tenant DB | driver-service locateInvite | Incognito invite |

---

## 6. Chapter 4.22 acceptance sign-off

| # | Client requirement | Automated | Manual UAT |
|---|-------------------|-----------|------------|
| 1 | Invite once before expiry | `test:auth:live` §2 | §3 Phase 2 rows 2.1–2.3 |
| 2 | Login creates session + audit | `test:auth:live` §3 | §3 Phase 6 row 6.1 |
| 3 | Password reset revokes sessions | `test:auth:live` §4 | §3 Phase 2 rows 2.4–2.6 |
| 4 | Suspended login denied + logged | `test:auth:live` §5 | §3 Phase 1 rows 1.2–1.3 |
| 5 | Driver invite + suspend sync | `test:auth:live` §6 | §3 Phase 7 rows 7.1–7.2 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Auth service unavailable` (503) | `cd backend && npm run start:dev` |
| Invite invalid in incognito (MKX) | Ensure driver-service tenant invite lookup fix is deployed; use `/invite?invite=` not `/app/drivers?invite=` |
| MFA loop at login | Confirm server time; re-enroll with recovery codes |
| Reset link not received | Dev: check notification log or auth-service response `resetUrl` |
| Session not revoked after reset | Check auth migrations; verify `tokenVersion` on user row |
| Staff invite 403 | Owner needs `users.create` + `users.assign_role` |
| Security events empty | Company → Security tab; ensure tenant security SQL applied |

---

## 8. What is explicitly out of scope (do not test as bugs)

- Entra / Google / SAML SSO  
- SMS OTP, FIDO2 / WebAuthn  
- Real SMTP delivery (notifications queued only)  
- Impossible-travel / full SIEM  
- Mobile biometric / offline vault  
- Hard-delete users with history  

---

## 9. Quick daily smoke (5 minutes)

1. `npm run test:auth:live:existing --prefix gateway` (or full `test:auth:live`)  
2. Login MKX owner → Company → Security loads  
3. Forgot-password form submits without 500  
4. User menu → Sessions & devices opens  
5. Optional: staff invite link opens in incognito  

---

**End of Chapter 4 Testing Guide**
