# Chapter 6 — Driver Management: Full Testing Guide

**Version:** 1.0  
**Date:** 2026-08-28  
**Scope:** All Chapter 6 phases (1–9) — lifecycle, qualifications, employment, payroll preview, availability, customs, equipment, safety/training/performance, search/dashboard, acceptance suite.

Related: [DRIVER-CHAPTER-6-COMPLETE.md](./DRIVER-CHAPTER-6-COMPLETE.md) · [DRIVER-CHAPTER-6-PLAN.md](./DRIVER-CHAPTER-6-PLAN.md) · [TESTING-GUIDES-INDEX.md](./TESTING-GUIDES-INDEX.md)

---

## 1. Before you start

### 1.1 Start the stack

```powershell
cd C:\other-projects\tripsheet\backend
npm run infra:up          # postgres + redis (if not already up)
npm run start:dev         # gateway + all microservices
```

In a second terminal, start the frontend:

```powershell
cd C:\other-projects\tripsheet\frontend
npm run dev
```

**Verify:** `http://localhost:3000/health` returns OK. Login must work (auth-service on `:3001`).

### 1.2 Apply migrations (once per environment)

```powershell
cd C:\other-projects\tripsheet\shared
npm run build

cd C:\other-projects\tripsheet\backend\services\driver-service
npx prisma generate
npx prisma migrate deploy
```

For **existing tenant companies**, apply tenant SQL:

```http
POST http://localhost:3000/api/tenants/schema-migrate-all
Authorization: Bearer <super-admin-token>
```

Or use Super Admin UI → tenant ops if available.

SQL files applied:

| File | Content |
|------|---------|
| `015_driver_chapter6.sql` | Lifecycle, qualifications, employment |
| `016_driver_chapter6_phase4567.sql` | Availability, equipment, safety, training |

### 1.3 Test accounts (seeded)

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| Super Admin | `admin@tripsheet.io` | `admin123` | Tenant migrate, cross-company |
| MKX Owner / HR | `admin@mkx.ca` | `mkx123` | Drivers tab, approve, dispatch, accounting |
| MKX Driver | `divyam@mkx.ca` | `driver123` | Driver dashboard, self-service availability |

---

## 2. Automated tests (run first)

These do **not** require manual clicking. Run after every Chapter 6 change.

### 2.1 In-process + unit (no Docker, no UI)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:drivers
```

**Expected:** All suites pass.

| Suite | What it validates |
|-------|-------------------|
| `driver-service/check-chapter6-acceptance.ts` | Lifecycle rules, expired medical blockers, equipment history close-prior-primary, border eligibility |
| `fleet-service/check-chapter6-acceptance.ts` | Fleet dispatch gate reason strings (medical, suspended, vacation) |
| `drivers.service.spec.ts` | `dispatch-ready`: missing docs, expired, suspended lifecycle, vacation availability |
| `equipment.service.spec.ts` | Assign primary truck closes previous primary |
| `loads.service.spec.ts` | Load create blocked when driver not dispatch-ready (medical) |

**Last run (2026-08-28):** 18 Jest tests + 2 acceptance scripts — **all passed**.

### 2.2 Invite lifecycle (driver-service)

```powershell
cd C:\other-projects\tripsheet\backend\services\driver-service
npm run test:rbac
```

Covers invite TTL / single-use contracts (Chapter 4 + driver invites).

### 2.3 Live gateway acceptance (full stack required)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:drivers:live
```

**Requires:** Gateway `:3000`, auth, company, driver, fleet services running.

**Optional env:**

```powershell
$env:DRIVER_OWNER_EMAIL = "admin@mkx.ca"
$env:DRIVER_OWNER_PASSWORD = "mkx123"
```

**What it proves live:**

1. Create driver → `dispatch-ready`, `border-eligible`, `performance` APIs
2. Invite create → revoke → regenerate
3. Equipment assign truck A → assign truck B → A closed, B active
4. Expired medical qualification → `dispatch-ready: false`

**Note:** If you see `Auth service unavailable` (HTTP 503), start `npm run start:dev` in `/backend` and retry.

### 2.4 Full Chapter 6 automated bundle

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:drivers:all
```

Runs `test:drivers` + `test:drivers:live`.

---

## 3. Manual UI testing — by feature

Log in as **admin@mkx.ca** unless noted. App path: **Workspace → Drivers** (and related tabs).

### Phase 1 — Lifecycle & auth sync

| # | Steps | Expected result |
|---|--------|-----------------|
| 1.1 | Drivers → **Send invite link** → complete onboarding as new driver | Driver appears with status **Pending HR Review** (not dispatch-eligible) |
| 1.2 | Open driver profile → **Approve** (HR) with all required docs uploaded | Status **Active**; green lifecycle pill |
| 1.3 | Dispatch → new load → driver picker (default filter) | Approved active driver **visible** |
| 1.4 | Profile → **Suspend** | Driver login fails; not in default dispatch picker |
| 1.5 | Re-login as suspended driver | Blocked at login with suspended message |
| 1.6 | Profile → **Archive** (or roster archive action) | Driver hidden from pickers; historical loads/sheets retained |

**Permissions:** `drivers.approve`, `drivers.suspend`, `drivers.archive`

---

### Phase 2 — Qualifications & compliance

| # | Steps | Expected result |
|---|--------|-----------------|
| 2.1 | Driver profile → **Qualifications** tab | Structured rows (licence, medical, etc.) |
| 2.2 | Upload **medical** doc with expiry **in the past** | Qualification/doc shows expired |
| 2.3 | Dispatch → assign load to that driver | **Blocked** with message citing missing/expired medical |
| 2.4 | Check audit (company audit log if exposed) | `compliance.dispatch_blocked` event with driver id + missing list |

**API check:**

```http
GET /api/drivers/{driverRecordId}/dispatch-ready
Authorization: Bearer {owner-token}
```

Expect: `{ "ready": false, "missing": ["medical"], ... }`

---

### Phase 3 — Employment & driver types

| # | Steps | Expected result |
|---|--------|-----------------|
| 3.1 | Drivers → **Add manually** or **Edit** | Fields: driver type, employee #, hire date, branch |
| 3.2 | Set driver type **Owner-Operator** | Profile shows OO pill / extended fields |
| 3.3 | Profile → **Employment** card | Employee #, hire date, branch displayed |
| 3.4 | Roster search by employee # or licence | Driver found |

---

### Phase 4 — Wage ↔ payroll (preview only)

| # | Steps | Expected result |
|---|--------|-----------------|
| 4.1 | Driver profile → set **wage contract** (pay type + rate) | Contract saved |
| 4.2 | **Accounting** → **New settlement** → select driver + period | Preview shows **contract wage (read-only)** line |
| 4.3 | Driver has trip sheets with expenses in period | Lines include `tripSheetId` / load refs |
| 4.4 | Create draft settlement | Succeeds with expense lines + informational wage line (no auto-pay) |

**Not in v1:** Automatic pay calculation from miles/loads.

---

### Phase 5 — Availability & customs

| # | Steps | Expected result |
|---|--------|-----------------|
| 5.1 | Driver profile → **Availability** → set **Vacation** → Save | Badge updates on roster |
| 5.2 | Dispatch → driver picker (default) | Vacation driver **hidden** |
| 5.3 | Dispatch → enable **Show all drivers** | Vacation driver visible |
| 5.4 | Assign load to vacation driver (if override allowed) | Server blocks (400) with availability reason |
| 5.5 | eManifest (ACI/ACE) → select driver | Only active + available in default list |
| 5.6 | eManifest → driver missing passport/medical → **Submit** | Blocked with border-eligibility message |
| 5.7 | Cross-border **Dispatch** load → ineligible driver | Fleet blocks assignment |

**API check:**

```http
GET /api/drivers/{id}/border-eligible
```

Expect: `{ eligible, missing[], warnings[] }` (FAST in warnings if absent).

---

### Phase 6 — Equipment assignment history (§6.19 #3)

| # | Steps | Expected result |
|---|--------|-----------------|
| 6.1 | Driver profile → **Equipment** tab → assign **primary truck** unit 101 | Row appears as **Active** |
| 6.2 | Assign different **primary truck** unit 102 | Unit 101 row shows **Closed** with end date; 102 **Active** |
| 6.3 | Assign primary **trailer** similarly | Separate history per asset type |
| 6.4 | Dispatch → new load → select same driver | Truck/trailer **pre-filled** from primary assignments |

---

### Phase 7 — Safety, training, performance

| # | Steps | Expected result |
|---|--------|-----------------|
| 7.1 | Profile → **Safety** → add incident (date + description) | Event listed |
| 7.2 | Profile → **Training** → add course + completion date | Record listed |
| 7.3 | Profile → **Performance** | Cards: miles, deliveries, on-time %, revenue (from loads) |

---

### Phase 8 — Search, dashboard, invites

| # | Steps | Expected result |
|---|--------|-----------------|
| 8.1 | Drivers roster → **Search** (name, email, licence, FAST) | Filters list |
| 8.2 | Filter **Branch** / **Compliance** (expiring, missing, FAST, hazmat) | Correct subset |
| 8.3 | Pending invites → **Revoke** | Link invalid; status revoked |
| 8.4 | Pending invites → **Regenerate** | New link; old token dead |
| 8.5 | Login as **divyam@mkx.ca** (driver) | Dashboard shows compliance alerts, payroll summary, availability |
| 8.6 | Driver sets availability **Off duty** → Save | Dispatch default picker hides driver |

---

## 4. API reference (gateway `:3000`)

All routes need `Authorization: Bearer {token}` and tenant context (company from JWT).

### Drivers

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/drivers?companyId=` | List roster |
| POST | `/api/drivers` | Create |
| PATCH | `/api/drivers/:id` | Update (incl. `availabilityStatus`, employment) |
| GET | `/api/drivers/:id/dispatch-ready` | Compliance gate |
| GET | `/api/drivers/:id/border-eligible` | Customs gate |
| GET | `/api/drivers/:id/performance` | KPI snapshot |
| POST | `/api/drivers/:id/approve` | HR activate |
| POST | `/api/drivers/:id/suspend` | Suspend + auth sync |
| POST | `/api/drivers/:id/archive` | Soft archive |

### Qualifications

| Method | Path |
|--------|------|
| GET | `/api/drivers/:driverId/qualifications` |
| POST | `/api/drivers/:driverId/qualifications` |
| PATCH | `/api/qualifications/:id` |
| DELETE | `/api/qualifications/:id` |

### Equipment

| Method | Path |
|--------|------|
| GET | `/api/drivers/:driverId/equipment-assignments` |
| POST | `/api/drivers/:driverId/equipment-assignments` |
| PATCH | `/api/equipment-assignments/:id/unassign` |

### Safety & training

| Method | Path |
|--------|------|
| GET/POST | `/api/drivers/:driverId/safety-events` |
| PATCH/DELETE | `/api/safety-events/:id` |
| GET/POST | `/api/drivers/:driverId/training-records` |
| PATCH/DELETE | `/api/training-records/:id` |

### Invites

| Method | Path |
|--------|------|
| POST | `/api/invites` `{ companyId }` |
| POST | `/api/invites/:id/revoke` |
| POST | `/api/invites/:id/regenerate` |

### Example: expired medical blocks dispatch

```powershell
# 1. Login
$r = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"admin@mkx.ca","password":"mkx123"}'
$token = $r.accessToken

# 2. Add expired medical qualification
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/api/drivers/{driverId}/qualifications" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"companyId":"c1","type":"medical","expiryDate":"2000-01-01"}'

# 3. Check dispatch-ready
Invoke-RestMethod -Uri "http://localhost:3000/api/drivers/{driverId}/dispatch-ready" `
  -Headers @{ Authorization = "Bearer $token" }
# Expect: ready = false, missing contains "medical"

# 4. Try create load (fleet)
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/loads" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"companyId":"c1","driverId":"{driverId}","origin":"Calgary","destination":"Edmonton"}'
# Expect: HTTP 400 with dispatch-ready message
```

---

## 5. Validation matrix (server rules)

| Rule | Enforced by | UI surface |
|------|-------------|------------|
| Only `active` lifecycle dispatch-eligible | `dispatch-ready` + fleet | Dispatch picker, load assign |
| Suspended/terminated/archived blocked | Auth + dispatch-ready | Login, pickers |
| Expired/missing licence, abstract, medical | Qualifications + docs | dispatch-ready, load assign |
| Unavailable/vacation/off_duty blocks assign | availabilityStatus + fleet | Dispatch picker filter |
| Cross-border driver ineligible | border-eligible + fleet/manifest | eManifest submit, CB load |
| Approve requires compliance docs (license, abstract, medical) | driver-service approve | HR Approve button |
| Primary equipment: one active per type | equipment assign | Equipment tab history |
| Invite revoke/regenerate | invite-service | Drivers pending invites |
| Settlement wage line read-only | accounting UI | No auto-pay deduction |

---

## 6. Chapter 6.19 acceptance sign-off

| # | Client requirement | Automated | Manual UAT |
|---|-------------------|-----------|------------|
| 1 | HR approve → Active → dispatch | Lifecycle contracts + live test | §3 Phase 1 rows 1.1–1.3 |
| 2 | Expired medical blocks dispatch + logged | Jest + acceptance + live test | §3 Phase 2 rows 2.2–2.4 |
| 3 | Equipment history A→B | equipment.service.spec + live test | §3 Phase 6 rows 6.1–6.2 |

**Sign-off checklist:** Print §3 tables and mark each row PASS/FAIL with tester name and date.

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Auth service unavailable` | `cd backend && npm run start:dev` |
| Driver missing new fields | Run `schema-migrate-all` for tenant |
| `dispatch-ready` always true incorrectly | Ensure qualifications seeded; check medical expiry |
| Equipment assign fails asset type | Asset id must exist in fleet or omit unitNo (optional fetch) |
| Driver picker empty | Check lifecycle active + availability available; try Show all |
| Live test login fails | Use MKX admin or set `DRIVER_OWNER_EMAIL/PASSWORD` |
| Frontend stale data | Hard refresh; ensure `apiEnabled` and gateway proxy up |

---

## 8. What is explicitly out of scope (do not test as bugs)

- AI performance score 0–100  
- Auto-pay from contract rates  
- Full document OCR / version history  
- ELD / HOS integration  
- Team driver pairing  

---

## 9. Quick daily smoke (5 minutes)

1. `npm run test:drivers` — all green  
2. Login MKX owner → Drivers → one search filter works  
3. Open Divyam profile → dispatch-ready loads (network tab or assign load)  
4. Driver login → compliance banner visible  
5. Optional: `npm run test:drivers:live` if stack is up  

---

**End of Chapter 6 Testing Guide**
