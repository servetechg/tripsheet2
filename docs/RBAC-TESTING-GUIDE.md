# Chapter 2 — RBAC & User Personas: Full Testing Guide

**Version:** 1.0  
**Date:** 2026-08-29  
**Scope:** Permission catalog, gateway gates, custom roles, persona matrix, audit on deny (Phases 1–5).

Related: [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) · [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md) · [AUTH-TESTING-GUIDE.md](./AUTH-TESTING-GUIDE.md)

---

## 1. Before you start

### 1.1 Start the stack

```powershell
cd C:\other-projects\tripsheet\backend
npm run infra:up
npm run start:dev
```

```powershell
cd C:\other-projects\tripsheet\frontend
npm run dev
```

**Verify:** Gateway `:3000`, auth `:3001`, company `:3002`, driver `:3003`, fleet `:3004`.

### 1.2 Apply migrations

```powershell
cd C:\other-projects\tripsheet\backend\services\auth-service
npx prisma migrate deploy && npx prisma db seed

cd C:\other-projects\tripsheet\backend\services\company-service
npx prisma migrate deploy && npx prisma db seed
```

Custom roles and security policy require tenant SQL on active companies:

```http
POST http://localhost:3000/api/tenants/schema-migrate-all
Authorization: Bearer <super-admin-token>
```

### 1.3 Test accounts & personas

| Persona | Email | Password | Typical grants |
|---------|-------|----------|----------------|
| Super Admin | `admin@tripsheet.io` | `admin123` | Platform only; `permissions: []` |
| Company Owner | `admin@mkx.ca` | `mkx123` | Full in-tenant access |
| Driver | `divyam@mkx.ca` | `driver123` | Own loads, docs, limited dashboard |

Create additional personas via Company → **Users** (dispatcher, accountant, HR, etc.).

---

## 2. Automated tests (run first)

### 2.1 In-process (no live stack)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:rbac
```

Runs:

| Component | What it validates |
|-----------|-------------------|
| Gateway `check-rbac.ts` | Route → permission mapping; accountant cannot PATCH loads; public auth paths |
| auth-service | Role catalog, persona grant sets |
| company-service | Custom role sanitizer |
| driver-service | Driver-scope helpers |
| fleet-service | Load scope rules |

### 2.2 Live persona architecture (Chapter 2.10)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:rbac:live
```

**Optional:**

```powershell
# Use MKX instead of ephemeral company
npm run test:rbac:live:existing --prefix gateway
$env:RBAC_OWNER_EMAIL = "admin@mkx.ca"
$env:RBAC_OWNER_PASSWORD = "mkx123"
```

**What it proves live:**

| # | Requirement | Suite |
|---|-------------|-------|
| 1 | Owner creates dispatcher → dispatch grants only | §4 |
| 2 | Driver sees only own loads | §7 |
| 3 | Accountant PATCH load → 403 + audit | §6 |

### 2.3 Full RBAC bundle

```powershell
npm run test:rbac:all
```

---

## 3. Manual UI testing — by feature

Log in as noted. Workspace path: **Company** tab for admin tasks.

### Phase 1 — Permission catalog & JWT

| # | Steps | Expected result |
|---|--------|-----------------|
| 1.1 | Login as owner → open browser devtools → decode JWT or call `/api/auth/me` | `permissions[]` array present |
| 1.2 | Login as super admin | Role `superadmin`; empty permissions |
| 1.3 | Owner opens Dispatch, Drivers, Accounting | All allowed |
| 1.4 | Owner tries platform create company | 403 (platform path) |

---

### Phase 2 — System roles & gateway enforcement

| # | Steps | Expected result |
|---|--------|-----------------|
| 2.1 | Create **dispatcher** user (Company → Users) | User created with dispatcher role |
| 2.2 | Login as dispatcher | Dispatch + Track visible; Accounting hidden or 403 |
| 2.3 | Dispatcher opens **Drivers** wage tab | 403 or tab hidden |
| 2.4 | Create **accountant** user | Accounting visible |
| 2.5 | Accountant opens Dispatch → edit load | **Blocked** (403) |
| 2.6 | Check Compliance → Audit (or API) | `rbac.deny` event for accountant load edit |

**Key permission codes to spot-check:**

- `dispatch.create`, `dispatch.view`, `dispatch.edit`
- `drivers.wage.edit`, `payroll.process`
- `accounting.view`, `users.create`, `company.delete`

---

### Phase 3 — Custom roles

| # | Steps | Expected result |
|---|--------|-----------------|
| 3.1 | Company → **Roles** → create custom role | e.g. “Payroll clerk” with subset of permissions |
| 3.2 | Assign custom role to staff user | User’s JWT reflects custom grants after re-login |
| 3.3 | User tries action outside custom role | 403 |
| 3.4 | Owner edits custom role → remove permission | User loses access after token refresh / re-login |

**Permissions:** `users.assign_role`, `users.view`

---

### Phase 4 — Security-adjacent RBAC (lockout, login history)

| # | Steps | Expected result |
|---|--------|-----------------|
| 4.1 | Company → **Security** → lockout threshold | Policy saved |
| 4.2 | Fail login N times for test user | Account locked |
| 4.3 | Owner **Unlock** user | Login succeeds |
| 4.4 | Owner views login history | Failed + success attempts listed |

*(Full auth lifecycle: see [AUTH-TESTING-GUIDE.md](./AUTH-TESTING-GUIDE.md).)*

---

### Phase 5 — Driver self-scope

| # | Steps | Expected result |
|---|--------|-----------------|
| 5.1 | Login as `divyam@mkx.ca` | Driver workspace only |
| 5.2 | Driver dashboard / loads | Only own assignments |
| 5.3 | Driver tries another driver’s profile URL | 403 / not found |
| 5.4 | Driver tries Company → Users | Route blocked |

---

### Phase 5 — UI permission gates (smoke)

| Tab / action | Owner | Dispatcher | Accountant | Driver |
|--------------|-------|------------|------------|--------|
| Dispatch create | ✓ | ✓ | ✗ | ✗ |
| Drivers invite | ✓ | ✗* | ✗ | ✗ |
| Accounting settlements | ✓ | ✗ | ✓ | ✗ |
| Company → Security | ✓ | ✗ | ✗ | ✗ |
| Company → API Keys | ✓** | ✗ | ✗ | ✗ |

\* Unless custom role grants `drivers.invite`  
\*\* Requires `admin.api_keys`

---

## 4. API reference (gateway `:3000`)

All routes need `Authorization: Bearer {token}` unless noted.

### Users & roles

| Method | Path | Permission (typical) |
|--------|------|----------------------|
| GET | `/api/auth/me` | Any authenticated |
| POST | `/api/auth/users` | `users.create` |
| PATCH | `/api/auth/users/:id` | `users.edit` |
| GET | `/api/companies/:id/custom-roles` | `users.view` |
| POST | `/api/companies/:id/custom-roles` | `users.assign_role` |

### Gated operations (examples)

| Method | Path | Allowed roles |
|--------|------|---------------|
| POST | `/api/loads` | dispatcher+, owner |
| PATCH | `/api/loads/:id` | dispatcher+, owner — **not** accountant |
| POST | `/api/invites` | `drivers.invite` or staff invite perms |
| GET | `/api/invoices` | accountant+, owner (plan may also gate) |
| POST | `/api/companies` | superadmin only |

### Example: accountant denied on load edit

```powershell
$r = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" -Body '{"email":"ACCT@example.com","password":"..."}'
$token = $r.accessToken

try {
  Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/loads/LOAD_ID" `
    -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" `
    -Body '{"status":"in_transit"}'
} catch {
  # Expect 403 Forbidden
}
```

---

## 5. Validation matrix (server rules)

| Rule | Enforced by | UI surface |
|------|-------------|------------|
| Deny by default | Gateway permission gate | 403 on API |
| JWT carries `permissions[]` | auth-service at login | `/me` |
| Superadmin platform-only | Gateway + empty grants | No company mutate |
| Owner full in-tenant | Role template | All company tabs |
| Custom roles tenant-local | company-service | Roles tab |
| Driver scoped by `driverId` | fleet + driver services | Driver workspace |
| Deny audited | Gateway `rbac.deny` | Compliance audit |
| Client `companyId` spoof ignored | Tenant middleware | Cross-tenant tests |

---

## 6. Chapter 2.10 acceptance sign-off

| # | Client requirement | Automated | Manual UAT |
|---|-------------------|-----------|------------|
| 1 | Admin creates dispatcher → role permissions only | `test:rbac:live` §4 | §3 Phase 2 rows 2.1–2.3 |
| 2 | Driver sees only own data | `test:rbac:live` §7 | §3 Phase 5 |
| 3 | Accountant edit dispatch denied + audit | `test:rbac:live` §6 | §3 Phase 2 rows 2.5–2.6 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| All actions 403 | Check JWT expiry; re-login |
| Custom role not applied | User must re-login after role change |
| Superadmin in company workspace | Wrong account — use `admin@tripsheet.io` |
| `rbac.deny` missing in audit | Verify gateway audit middleware; check company audit API |
| Dispatcher sees accounting | Wrong role assigned; check `/api/auth/me` |
| Live test provision fails | Super admin login; company-service up |

---

## 8. What is explicitly out of scope (do not test as bugs)

- 300+ appendix permission codes  
- Multi-company single user  
- Email OTP / SSO role mapping  
- Shop technician as system role (use custom role)  
- Field-level ACL inside one screen  

---

## 9. Quick daily smoke (5 minutes)

1. `npm run test:rbac` — all green  
2. Login owner → `/api/auth/me` has `users.create`  
3. Login dispatcher → Dispatch works; PATCH load on accounting user fails  
4. Login driver → only driver routes  
5. Optional: `npm run test:rbac:live:existing`  

---

**End of Chapter 2 Testing Guide**
