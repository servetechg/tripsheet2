# TripSheet / FleetQuix — Production Manual Testing Guide

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | September 7, 2026 |
| **Environment** | Production UAT |
| **Production URL** | `https://tripsheet.187.124.55.20.sslip.io/` |
| **Staging URL** (optional pre-check) | `https://staging.tripsheet.187.124.55.20.sslip.io/` |

**Purpose:** Step-by-step manual test script to verify **every major feature** on production before client sign-off. Each test case has a unique ID, steps, expected result, and pass/fail checkbox.

**Related docs:**
- [PRD-IMPLEMENTATION-STATUS-REPORT.md](./PRD-IMPLEMENTATION-STATUS-REPORT.md) — what is built vs remaining
- [TESTING-GUIDES-INDEX.md](./TESTING-GUIDES-INDEX.md) — chapter-specific deep dives
- Chapter guides: RBAC · Multi-tenant · Auth · MDM · Drivers · Enterprise features

---

## Table of contents

1. [Before you start](#1-before-you-start)
2. [Test data & accounts](#2-test-data--accounts)
3. [How to record results](#3-how-to-record-results)
4. [Recommended test order](#4-recommended-test-order)
5. [Section A — Platform health & super admin](#section-a--platform-health--super-admin)
6. [Section B — Authentication & security](#section-b--authentication--security)
7. [Section C — Company setup & administration](#section-c--company-setup--administration)
8. [Section D — Users, roles & RBAC](#section-d--users-roles--rbac)
9. [Section E — Master data (MDM)](#section-e--master-data-mdm)
10. [Section F — Assets & fleet registry](#section-f--assets--fleet-registry)
11. [Section G — Driver management & onboarding](#section-g--driver-management--onboarding)
12. [Section H — Dispatch & load management](#section-h--dispatch--load-management)
13. [Section I — Tracking & map](#section-i--tracking--map)
14. [Section J — eManifest & cross-border](#section-j--emanifest--cross-border)
15. [Section K — Fleet operations (maintenance)](#section-k--fleet-operations-maintenance)
16. [Section L — Trip sheets](#section-l--trip-sheets)
17. [Section M — Messages & communications](#section-m--messages--communications)
18. [Section N — Compliance & audit](#section-n--compliance--audit)
19. [Section O — Reports & analytics](#section-o--reports--analytics)
20. [Section P — Accounting & settlements](#section-p--accounting--settlements)
21. [Section Q — Driver portal](#section-q--driver-portal)
22. [Section R — Staff personas & permissions](#section-r--staff-personas--permissions)
23. [Section S — UI, responsive & regression](#section-s--ui-responsive--regression)
24. [Section T — Known limitations (do not fail)](#section-t--known-limitations-do-not-fail)
25. [Sign-off sheet](#sign-off-sheet)

---

## 1. Before you start

### 1.1 Production pre-flight checklist

Complete **before** running test cases. All must pass.

| # | Check | Pass |
|---|-------|:----:|
| PF-01 | Production URL loads login page (no 502/503) | ☐ |
| PF-02 | `GET /health` on gateway returns OK (browser or curl) | ☐ |
| PF-03 | Super admin can log in (`admin@tripsheet.io`) | ☐ |
| PF-04 | At least one company exists with tenant DB status **active** | ☐ |
| PF-05 | Test company has **Professional** or **Enterprise** plan (Accounting tab visible) | ☐ |
| PF-06 | Browser: Chrome or Edge (latest); clear cache if stale UI after deploy | ☐ |
| PF-07 | Tester has notepad/spreadsheet for recording TC IDs and defects | ☐ |
| PF-08 | Optional: run same suite on staging first if production was just deployed | ☐ |

**Health check (optional):**
```bash
curl -s https://tripsheet.187.124.55.20.sslip.io/api/health
```

### 1.2 After a fresh production reset

If `./deploy/scripts/reset-fresh.sh --production` was run:

1. Log in as super admin
2. Create a new test company (or restore seed data)
3. Wait for tenant DB status **active** (refresh Companies tab)
4. Log in as company owner and complete Sections C → G before dispatch tests

### 1.3 Defect reporting template

When a test fails, record:

| Field | Value |
|-------|-------|
| Test ID | e.g. TC-DISP-003 |
| Environment | Production |
| Role used | e.g. Company owner |
| Steps to reproduce | … |
| Expected | … |
| Actual | … |
| Screenshot | attach |
| Severity | Blocker / Major / Minor |

---

## 2. Test data & accounts

### 2.1 Platform accounts

| Role | Email | Password | Home route |
|------|-------|----------|------------|
| Super admin | `admin@tripsheet.io` | `admin123` | `/admin/companies` |
| Company owner (MKX) | `admin@mkx.ca` | `mkx123` | `/app/dashboard` |
| Driver (MKX) | `divyam@mkx.ca` | `driver123` | `/driver/sheets` |

> If MKX does not exist after a fresh reset, create a company via super admin and use the owner account created during provisioning.

### 2.2 Accounts to create during testing

Create these via **Company → Users** (Section D) and reuse in later sections:

| Persona | Suggested email | Role | Used in |
|---------|-----------------|------|---------|
| Dispatcher | `dispatcher@testco.local` | Dispatcher | Section R |
| Accountant | `accountant@testco.local` | Accountant | Section R, P |
| HR manager | `hr@testco.local` | HR Manager | Section G |
| New driver (invite) | `newdriver@testco.local` | (via invite) | Section G |

### 2.3 Sample data values (reuse across tests)

| Entity | Sample value |
|--------|--------------|
| Broker | `Test Broker Inc` |
| Customer | `Acme Shipper` |
| Location | `Toronto, ON` → `Chicago, IL` |
| Commodity | `General Freight` |
| Truck unit | `TRK-101` |
| Trailer unit | `TRL-201` |
| Load customer rate | `2500` |
| Load carrier cost | `1800` |
| Trip sheet expense | `45.00` fuel |

---

## 3. How to record results

- Mark **Pass ☐ → ☑** when expected result is fully met
- Mark **Fail** and log defect (Section 1.3)
- Mark **Skip** with reason if blocked by earlier failure
- Mark **N/A** for known limitations (Section T)

**Summary counters** (fill at end):

| Section | Total TCs | Pass | Fail | Skip |
|---------|----------:|-----:|-----:|-----:|
| A — Super admin | 8 | | | |
| B — Auth | 14 | | | |
| C — Company | 22 | | | |
| D — Users/RBAC | 10 | | | |
| E — MDM | 18 | | | |
| F — Assets | 8 | | | |
| G — Drivers | 20 | | | |
| H — Dispatch | 16 | | | |
| I — Track | 5 | | | |
| J — eManifest | 6 | | | |
| K — Fleet ops | 8 | | | |
| L — Trip sheets | 6 | | | |
| M — Messages | 6 | | | |
| N — Compliance | 7 | | | |
| O — Reports | 8 | | | |
| P — Accounting | 12 | | | |
| Q — Driver portal | 14 | | | |
| R — Staff/RBAC | 8 | | | |
| S — UI/regression | 10 | | | |
| **TOTAL** | **~188** | | | |

---

## 4. Recommended test order

Dependencies — run in this order on production:

```
Pre-flight (PF-01–08)
  → A Super admin (create/verify company)
  → B Auth (login flows)
  → C Company setup (profile, branding, plan)
  → D Users & roles
  → E Master data
  → F Assets (trucks, trailers)
  → G Drivers (invite → onboard → approve)
  → H Dispatch (assign load)
  → I Track (in-transit)
  → J eManifest (if cross-border)
  → K Fleet ops
  → L Trip sheets (driver + admin)
  → M Messages
  → N Compliance & audit
  → O Reports
  → P Accounting
  → Q Driver portal (full pass)
  → R Staff personas
  → S UI/regression
```

---

## Section A — Platform health & super admin

**Login as:** `admin@tripsheet.io` / `admin123`  
**Route:** `/admin/companies`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-SA-001 | Companies tab loads | Open production URL → login as super admin | Redirect to `/admin/companies`; company list visible | ☐ |
| TC-SA-002 | Company card details | Expand or view an existing company card | Shows slug, plan name, tenant DB name, status | ☐ |
| TC-SA-003 | Tenant status active | Check test company tenant row | Status = **active** (not pending/failed) | ☐ |
| TC-SA-004 | Create company validation | Click **+ New Company** → submit empty form | Validation errors; no company created | ☐ |
| TC-SA-005 | Create test company | Fill name, slug, plan (Professional) → Create | Success toast; new card appears; tenant DB provisioning starts | ☐ |
| TC-SA-006 | Change company plan | On a company card → change plan dropdown | Plan updates; toast confirms | ☐ |
| TC-SA-007 | Tenant ops tab | Click **Tenant ops** tab | Summary table: tenant count, disk, connections, errors | ☐ |
| TC-SA-008 | Schema migrate-all | Tenant ops → run schema migrate (if button available) or verify no tenants in error state | Completes without error; failed tenants show structured issue alert | ☐ |

---

## Section B — Authentication & security

### B.1 Login & session

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-AUTH-001 | Login page | Go to `/login` (logged out) | Sign in heading, email, password, Continue button | ☐ |
| TC-AUTH-002 | Empty form | Leave fields blank | Continue disabled | ☐ |
| TC-AUTH-003 | Invalid credentials | bad@example.com / wrongpass → Continue | Error: invalid email or password | ☐ |
| TC-AUTH-004 | Super admin login | admin@tripsheet.io / admin123 | Redirect `/admin/companies` | ☐ |
| TC-AUTH-005 | Company owner login | admin@mkx.ca / mkx123 | Redirect `/app/dashboard` | ☐ |
| TC-AUTH-006 | Driver login | divyam@mkx.ca / driver123 | Redirect `/driver/sheets` | ☐ |
| TC-AUTH-007 | Logout | Login as owner → logout | Returns to `/login`; back button does not restore session | ☐ |
| TC-AUTH-008 | Session refresh | Login as owner → F5 refresh | Still on `/app/dashboard`; sidebar visible | ☐ |
| TC-AUTH-009 | Route guard | Logged out → open `/app/dashboard` | Redirect to `/login` | ☐ |
| TC-AUTH-010 | Role guard | Login as driver → open `/admin/companies` | Redirect to `/driver/...` | ☐ |

### B.2 Password recovery

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-AUTH-011 | Forgot password page | `/forgot-password` → enter owner email → Send | Success message (reset link sent or account exists) | ☐ |
| TC-AUTH-012 | Reset password (if link available) | Use reset link from email/logs → set new password → login | Old password fails; new password works | ☐ |

### B.3 MFA (optional — if enabled on test company)

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-AUTH-013 | MFA enroll | Company → Security → require MFA → user enrolls TOTP | QR/setup flow; recovery codes shown | ☐ |
| TC-AUTH-014 | MFA login | Logout → login with MFA user | Prompt for TOTP code before dashboard | ☐ |

---

## Section C — Company setup & administration

**Login as:** company owner (`admin@mkx.ca`)  
**Route:** `/app/company`

### C.1 Company sub-tabs navigation

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CO-001 | Company tab loads | `/app/company` | Sub-tabs: Profile, Users, Roles, Settings, Branches, Master data, etc. | ☐ |
| TC-CO-002 | All sub-tabs clickable | Click each sub-tab | No blank screen or JS error | ☐ |

### C.2 Profile & settings

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CO-003 | Save company profile | Profile → edit name/tagline/address → Save | Toast "Profile saved"; persists after refresh | ☐ |
| TC-CO-004 | Settings packs | Settings → toggle dispatch options (e.g. driver acceptance) → Save | Settings saved; reload shows same values | ☐ |
| TC-CO-005 | Branch CRUD | Branches → add branch name/code → Save | Branch appears in list | ☐ |
| TC-CO-006 | Department CRUD | Departments → add department → Save | Department appears in list | ☐ |

### C.3 Branding & documents

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CO-007 | Branding save | Branding → set accent color → Save | Saved; print trip sheet later uses accent (TC-L-004) | ☐ |
| TC-CO-008 | Company document vault | Documents → upload PDF → list | File appears; delete removes it | ☐ |

### C.4 API keys & security

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CO-009 | Create API key | API Keys → Create → copy secret | Key shown once; appears in list | ☐ |
| TC-CO-010 | Revoke API key | Revoke created key | Key marked revoked/inactive | ☐ |
| TC-CO-011 | Security policy | Security → change min password length → Save | Policy saved | ☐ |
| TC-CO-012 | Login history | Security → scroll login history | Recent login events listed | ☐ |
| TC-CO-013 | Security events | Security → security events list | Events visible after login/actions | ☐ |

### C.5 Notifications & plan

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CO-014 | Notification rules | Alerts → toggle doc expiry rule | Toggle persists after refresh | ☐ |
| TC-CO-015 | Plan panel | Plan → view entitlements | Shows plan name, max drivers, feature flags | ☐ |
| TC-CO-016 | Accounting entitlement | Starter plan company (if available) | Accounting tab hidden; Professional shows tab | ☐ |

---

## Section D — Users, roles & RBAC

**Route:** `/app/company` → **Users** or **Roles** sub-tabs, or `/app/users`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-UR-001 | Users list | Open Users sub-tab | Staff users listed with roles | ☐ |
| TC-UR-002 | Invite staff user | Users → invite dispatcher email + role → send | Invite created; link copyable | ☐ |
| TC-UR-003 | Complete staff invite | Open invite link in incognito → set password → login | User active; lands on `/workspace` placeholder | ☐ |
| TC-UR-004 | Custom role create | Roles → create role from dispatcher base → add/remove permission | Role saved in list | ☐ |
| TC-UR-005 | Assign custom role | Invite user with custom role | User JWT has only granted permissions | ☐ |
| TC-UR-006 | Suspend user | Suspend a test staff user | User cannot login | ☐ |
| TC-UR-007 | Unlock user | Unlock suspended user | User can login again | ☐ |
| TC-UR-008 | Devices / sessions | Users → view sessions (if UI available) | Active sessions listed | ☐ |
| TC-UR-009 | Remote revoke session | Revoke a session | That session invalidated | ☐ |
| TC-UR-010 | Owner full access | Login as owner → all sidebar tabs | All permitted tabs visible per role | ☐ |

---

## Section E — Master data (MDM)

**Route:** `/app/company` → **Master data** sub-tab

Test each master data kind. For each: **Add → verify in list → use in dispatch/accounting picker → refresh persists**.

| ID | Kind | Steps | Expected result | Pass |
|----|------|-------|-----------------|:----:|
| TC-MDM-001 | Locations | Add location (name, city, region) | Appears in dispatch origin/destination pickers | ☐ |
| TC-MDM-002 | Brokers | Add broker | Appears in dispatch broker select | ☐ |
| TC-MDM-003 | Customers | Add customer | Available for invoices (Section P) | ☐ |
| TC-MDM-004 | Consignees | Add consignee | Saved in list | ☐ |
| TC-MDM-005 | Carriers (subcontract) | Add carrier | Appears in dispatch carrier select | ☐ |
| TC-MDM-006 | Commodities | Add commodity | Appears in dispatch commodity select | ☐ |
| TC-MDM-007 | Warehouses | Add warehouse | Saved in list | ☐ |
| TC-MDM-008 | Ports of entry | View seeded ports | ACE/ACI/PAPS/PARS flags visible | ☐ |
| TC-MDM-009 | Vendors | Add maintenance vendor | Available in Fleet Ops | ☐ |
| TC-MDM-010 | Fuel stations | Add fuel station | Saved in list | ☐ |
| TC-MDM-011 | Cost centers | Add cost center | Saved in list | ☐ |
| TC-MDM-012 | Payroll categories | Add category | Saved in list | ☐ |
| TC-MDM-013 | Reference data | Add reference entry | Saved in list | ☐ |
| TC-MDM-014 | Inactive broker blocked | Set broker inactive → open dispatch picker | Inactive broker not selectable | ☐ |
| TC-MDM-015 | CSV export brokers | Import/Export → export brokers CSV | File downloads | ☐ |
| TC-MDM-016 | CSV import brokers | Import sample CSV dry-run then import | Rows appear in broker list | ☐ |
| TC-MDM-017 | Duplicate suggestion | Add broker with similar name | Duplicate warning/suggestion shown | ☐ |
| TC-MDM-018 | Merge (if UI) | Merge duplicate location/broker | Survivor record kept; audit logged | ☐ |

---

## Section F — Assets & fleet registry

**Route:** `/app/assets`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-AST-001 | Add truck | Assets → add truck unit, VIN, plate | Truck appears in list and dispatch truck picker | ☐ |
| TC-AST-002 | Add trailer | Add trailer unit | Appears in dispatch trailer picker | ☐ |
| TC-AST-003 | Expiry dates | Set insurance/plate expiry (one past date) | Saved on asset record | ☐ |
| TC-AST-004 | Out of service | Set truck status Out of Service | Dispatch truck picker blocks or shows reason | ☐ |
| TC-AST-005 | Edit asset | Change unit number → save | Persists after refresh | ☐ |
| TC-AST-006 | Equipment type (non-truck) | Add equipment unit if UI available | Listed under assets | ☐ |
| TC-AST-007 | Asset search/filter | Search by unit number | Filters list correctly | ☐ |
| TC-AST-008 | Delete/deactivate | Deactivate an asset | No longer assignable on new dispatch | ☐ |

---

## Section G — Driver management & onboarding

**Route:** `/app/drivers`

### G.1 Invite & onboarding

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-DRV-001 | Create driver invite | Drivers → invite flow → copy link | Invite link generated; pending invite in list | ☐ |
| TC-DRV-002 | SMS invite (optional) | Enter phone → send SMS invite | Success toast; SMS in Reports log (simulated if no Twilio) | ☐ |
| TC-DRV-003 | Complete onboarding | Incognito → open invite link → set password, profile, docs | Onboarding wizard completes | ☐ |
| TC-DRV-004 | Upload required docs | Upload license, abstract, medical | Docs show uploaded status | ☐ |
| TC-DRV-005 | Sign contract (driver) | Onboarding → sign contract checkbox | Contract marked signed by driver | ☐ |
| TC-DRV-006 | Pending HR status | After onboarding | Driver status **Pending HR Review** | ☐ |
| TC-DRV-007 | Admin approve | Owner → driver profile → Approve | Status **Active**; dispatch-ready true | ☐ |
| TC-DRV-008 | Admin countersign contract | Driver profile → contract → admin sign | Both signatures recorded | ☐ |
| TC-DRV-009 | Wage terms | Set pay type (per mile), rate, unit on contract | Saved; visible on driver contract tab | ☐ |
| TC-DRV-010 | Revoke invite | Pending invite → Revoke | Link invalid on open | ☐ |
| TC-DRV-011 | Regenerate invite | Regenerate → new link | Old link dead; new link works | ☐ |

### G.2 Driver profile & lifecycle

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-DRV-012 | Driver search | Drivers tab → search by name/email | Filters correctly | ☐ |
| TC-DRV-013 | Qualifications | Profile → add/update medical expiry | Saved on qualification record | ☐ |
| TC-DRV-014 | Expired medical blocks dispatch | Set medical expired → try assign load | Dispatch blocked with reason | ☐ |
| TC-DRV-015 | Availability | Profile → set availability (e.g. unavailable) | Dispatch picker filters or warns | ☐ |
| TC-DRV-016 | Equipment assignment | Assign truck A → then truck B | History shows A closed, B active | ☐ |
| TC-DRV-017 | Safety event | Add safety event on profile | Appears in safety tab/list | ☐ |
| TC-DRV-018 | Training record | Add training record | Appears in training list | ☐ |
| TC-DRV-019 | Performance stats | Open performance tab | Miles / deliveries / on-time % shown | ☐ |
| TC-DRV-020 | Suspend driver | Suspend active driver | Cannot login; not dispatch-ready | ☐ |

---

## Section H — Dispatch & load management

**Route:** `/app/dispatch`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-DISP-001 | Dispatch tab loads | Open Dispatch | Load list and **+ Assign Load** visible | ☐ |
| TC-DISP-002 | Empty validation | Open assign form → save empty | Field validation errors | ☐ |
| TC-DISP-003 | Assign load (happy path) | Select dispatch-ready driver, truck, trailer, origin, destination, times | Load created; appears in list as **Assigned** | ☐ |
| TC-DISP-004 | Load economics | Add customer rate 2500, carrier cost 1800, FSC 150, detention 2h @ 75, miles 1200 | Card shows Rev / Cost / Margin ≈ 1050 | ☐ |
| TC-DISP-005 | Multi-stop | Add Stop 1 (e.g. Regina, SK) | Stop visible on load card | ☐ |
| TC-DISP-006 | Broker & commodity | Select MDM broker and commodity | Saved on load; names display on card | ☐ |
| TC-DISP-007 | Compliance block | Try driver without license/abstract/medical | Create blocked with clear message | ☐ |
| TC-DISP-008 | OOS truck block | Assign Out-of-Service truck | Blocked with reason | ☐ |
| TC-DISP-009 | Cross-border | Enable cross-border → select port of entry | ACE/ACI/PAPS/PARS populated | ☐ |
| TC-DISP-010 | Edit load | Edit rates on existing load → save | Updates persist; margin recalculates | ☐ |
| TC-DISP-011 | Status → In transit | Change Assigned → In transit | Status updates; track tab shows active | ☐ |
| TC-DISP-012 | Status → Delivered | In transit → Delivered | Status delivered; actual delivery set | ☐ |
| TC-DISP-013 | Invalid transition | Try Assigned → Delivered directly | Blocked or prevented | ☐ |
| TC-DISP-014 | Cancel load | Cancel an assigned load | Status cancelled | ☐ |
| TC-DISP-015 | Upload dispatch doc | Attach BOL/POD on load or driver docs | Doc typed and linked | ☐ |
| TC-DISP-016 | Load comments | Add comment on load (Messages section) | Comment persists (see TC-MSG-003) | ☐ |

---

## Section I — Tracking & map

**Route:** `/app/track`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-TRK-001 | Track tab loads | Open Track with in-transit load | Map and load list visible | ☐ |
| TC-TRK-002 | Select load on map | Click in-transit load | Details panel: speed, last update, ETA | ☐ |
| TC-TRK-003 | Simulated movement | Wait ~10s on in-transit load | Position/speed updates (simulated) | ☐ |
| TC-TRK-004 | Delivered not tracked | Select delivered load | No movement simulation | ☐ |
| TC-TRK-005 | Navigate from dispatch | Dispatch → Track action on load | Opens track focused on that load | ☐ |

---

## Section J — eManifest & cross-border

**Route:** `/app/emanifest`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-EM-001 | eManifest tab loads | Open eManifest | Manifest list / create UI visible | ☐ |
| TC-EM-002 | Create manifest | Create manifest linked to cross-border load | Manifest row created | ☐ |
| TC-EM-003 | Port customs flags | Select port on manifest | ACE/ACI/PAPS/PARS fields populated | ☐ |
| TC-EM-004 | Simulated filing | Submit/file manifest | Status changes (simulated — not live CBSA) | ☐ |
| TC-EM-005 | Accepted countdown | Manifest accepted state | Countdown/timer UI if applicable | ☐ |
| TC-EM-006 | Carrier profile | Company settings / eManifest carrier codes | SCAC/DOT/CBSA codes saved | ☐ |

---

## Section K — Fleet operations (maintenance)

**Route:** `/app/fleet`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-FLT-001 | Maintenance tab | Fleet Ops → maintenance | Form: asset, type PM/Repair, title, cost, date | ☐ |
| TC-FLT-002 | Add maintenance record | Save PM for truck | Row in list; persists after refresh | ☐ |
| TC-FLT-003 | DVIR tab | Switch to DVIR → add inspection | Driver + asset + Satisfactory/Defects saved | ☐ |
| TC-FLT-004 | Expiry tab | Open expiry with past-due asset | Expired asset listed | ☐ |
| TC-FLT-005 | Maintenance vendor | Select vendor from MDM on maintenance | Vendor linked | ☐ |
| TC-FLT-006 | Audit on maintenance | After create → Compliance audit | `maintenance.create` event logged | ☐ |
| TC-FLT-007 | Edit maintenance | Edit title/cost | Updates persist | ☐ |
| TC-FLT-008 | Reports integration | After maintenance → Reports analytics | Maintenance by truck reflects spend | ☐ |

---

## Section L — Trip sheets

**Routes:** `/app/sheets` (admin), `/driver/sheets` (driver)

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-SHT-001 | Admin sheets tab | Open Sheets as owner | Trip sheet list visible | ☐ |
| TC-SHT-002 | Driver creates sheet | Login driver → Sheets → new sheet + expenses | Sheet saved with expense lines | ☐ |
| TC-SHT-003 | Admin views driver sheet | Owner → Sheets → open driver sheet | Expenses visible | ☐ |
| TC-SHT-004 | Print preview | Print preview on sheet | Formatted sheet; branding accent if set (TC-CO-007) | ☐ |
| TC-SHT-005 | Edit sheet | Driver edits draft sheet | Changes persist | ☐ |
| TC-SHT-006 | Settlement link | Sheet expenses appear in settlement preview (Section P) | Expense total matches | ☐ |

---

## Section M — Messages & communications

**Route:** `/app/messages`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-MSG-001 | Messages tab loads | Open Messages | Thread list / compose UI | ☐ |
| TC-MSG-002 | Send driver message | Select driver → Driver thread → send | Message appears in list | ☐ |
| TC-MSG-003 | Load comment | Select load → add comment | Comment listed on load | ☐ |
| TC-MSG-004 | Internal thread | Send internal message | Appears in internal thread | ☐ |
| TC-MSG-005 | Manual SMS | Customer/manual SMS → phone + body → send | Success; logged under Reports → Recent SMS | ☐ |
| TC-MSG-006 | Persist after refresh | Refresh page | Messages/comments still visible | ☐ |

---

## Section N — Compliance & audit

**Route:** `/app/compliance`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-CMP-001 | Compliance tab loads | Open Compliance | Document artifacts + audit sections | ☐ |
| TC-CMP-002 | Compliance artifacts | After uploading BOL/POD (TC-DISP-015) | Artifacts listed with type + driver | ☐ |
| TC-CMP-003 | Expiring docs list | Docs with near expiry | Shown in compliance expiring section | ☐ |
| TC-CMP-004 | Send expiry SMS | Send expiry SMS (admin needs phone) | Toast success; SMS log entry; audit event | ☐ |
| TC-CMP-005 | Audit log | Perform audited action → Compliance → Audit | Event with action, user, timestamp | ☐ |
| TC-CMP-006 | Audit refresh | Click Refresh on audit log | Latest events loaded | ☐ |
| TC-CMP-007 | RBAC deny logged | Accountant attempts forbidden action (Section R) | `rbac.deny` in audit if applicable | ☐ |

---

## Section O — Reports & analytics

**Route:** `/app/reports`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-RPT-001 | Reports tab loads | Open Reports | Summary cards + analytics sections | ☐ |
| TC-RPT-002 | Gross margin | After load with economics (TC-DISP-004) | Margin card > 0 | ☐ |
| TC-RPT-003 | CPM / fuel spend | With trip fuel expenses | Fuel spend reflects data | ☐ |
| TC-RPT-004 | Driver pay | With settlements | Driver pay metric updates | ☐ |
| TC-RPT-005 | OTP % | Deliver load with ETA vs actual | OTP percentage shown | ☐ |
| TC-RPT-006 | AR unpaid | Create unpaid invoice (Section P) | AR unpaid card > 0 | ☐ |
| TC-RPT-007 | Revenue by lane | View lane breakdown | Origin/destination lanes listed | ☐ |
| TC-RPT-008 | Recent SMS log | After TC-MSG-005 | SMS entry in Recent SMS section | ☐ |

---

## Section P — Accounting & settlements

**Route:** `/app/accounting`  
**Requires:** Professional or Enterprise plan

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-ACC-001 | Accounting tab visible | Owner on Professional plan | Accounting tab in sidebar | ☐ |
| TC-ACC-002 | Starter plan gate | Login to Starter company (if exists) | Accounting tab hidden | ☐ |
| TC-ACC-003 | Seed COA | Billing → Seed default accounts | Account list populated | ☐ |
| TC-ACC-004 | Create invoice | Customer + amount + optional load → Create | Invoice status sent; in list | ☐ |
| TC-ACC-005 | Create bill | Vendor + amount → Create | Bill in AP list | ☐ |
| TC-ACC-006 | Customer payment | Record payment against invoice | Invoice amountPaid increases; status toward paid | ☐ |
| TC-ACC-007 | Vendor payment | Record payment against bill | Bill balance reduced | ☐ |
| TC-ACC-008 | Invoice aging | Reports → invoice aging | Unpaid invoice appears in bucket | ☐ |
| TC-ACC-009 | New settlement | Select driver + date range with trip sheet expenses | Preview lines shown | ☐ |
| TC-ACC-010 | Settlement workflow | Create draft → Approve → Mark paid | Status flow draft → approved → paid | ☐ |
| TC-ACC-011 | Wage info line | Driver with contract pay type | Informational wage line in preview (auto-pay N/A) | ☐ |
| TC-ACC-012 | Delete draft settlement | Delete draft settlement | Removed from list | ☐ |

---

## Section Q — Driver portal

**Login as:** `divyam@mkx.ca` / `driver123` (or newly onboarded driver)  
**Route:** `/driver/sheets`

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-DP-001 | Driver redirect | Login as driver | Lands on `/driver/sheets` | ☐ |
| TC-DP-002 | All driver tabs | Click Sheets, My Docs, Contract, My Load | Each tab loads without error | ☐ |
| TC-DP-003 | Sheets tab | View/create trip sheet | Same as TC-SHT-002 | ☐ |
| TC-DP-004 | My Docs upload | Upload typed document (PDF/image) | Upload succeeds; appears in list | ☐ |
| TC-DP-005 | Doc type validation | Upload wrong file type if restricted | Error message shown | ☐ |
| TC-DP-006 | Contract tab | View contract terms | Pay type, rate, terms visible | ☐ |
| TC-DP-007 | Sign contract | Sign if not signed | signedByDriver true | ☐ |
| TC-DP-008 | My Load tab | With assigned load | Current load details shown | ☐ |
| TC-DP-009 | Load status display | After dispatch status changes | Driver sees updated status | ☐ |
| TC-DP-010 | Settlements summary | View payroll/settlements on dashboard | Pending/paid counts shown | ☐ |
| TC-DP-011 | Equipment info | View assigned truck/trailer | Assignment visible | ☐ |
| TC-DP-012 | Logout | Logout | Returns to login | ☐ |
| TC-DP-013 | Blocked from admin | Navigate to `/app/dashboard` | Redirect to driver portal | ☐ |
| TC-DP-014 | Mobile viewport | Resize to phone width (~390px) | Layout usable; nav accessible | ☐ |

---

## Section R — Staff personas & permissions

Create dispatcher and accountant accounts in Section D first.

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-ST-001 | Dispatcher login | Login as dispatcher | Lands on `/workspace` — "Workspace coming next" | ☐ |
| TC-ST-002 | Accountant login | Login as accountant | Same placeholder (expected until staff UI ships) | ☐ |
| TC-ST-003 | Dispatcher API scope | Dispatcher token via API or UI action if exposed | Has dispatch permissions; not payroll admin | ☐ |
| TC-ST-004 | Accountant read loads | Accountant views loads (if any UI) | Read OK | ☐ |
| TC-ST-005 | Accountant edit dispatch denied | Accountant tries PATCH load (API or UI) | 403 Forbidden | ☐ |
| TC-ST-006 | Driver self-scope | Driver API/list loads | Only own loads visible | ☐ |
| TC-ST-007 | Custom role enforcement | User with trimmed custom role | UI/API respects missing permissions | ☐ |
| TC-ST-008 | Suspended company | Super admin suspends tenant → user login | 403 / login denied | ☐ |

---

## Section S — UI, responsive & regression

| ID | Test case | Steps | Expected result | Pass |
|----|-----------|-------|-----------------|:----:|
| TC-UI-001 | All owner sidebar tabs | Login owner → click each tab | All 14 tabs load (Accounting if entitled) | ☐ |
| TC-UI-002 | Theme toggle | Toggle dark/light theme | Theme persists on navigation | ☐ |
| TC-UI-003 | Service health banner | If API down briefly | Banner shows; recovers when API up | ☐ |
| TC-UI-004 | Invalid invite token | `/invite?invite=invalid` | Error message; no crash | ☐ |
| TC-UI-005 | Unknown route | `/not-a-route` | Sensible 404 or redirect | ☐ |
| TC-UI-006 | Root URL | `/` logged out | Redirect to login | ☐ |
| TC-UI-007 | Browser back | Login → navigate tabs → back | No auth loop or blank page | ☐ |
| TC-UI-008 | Dashboard widgets | `/app/dashboard` | Stats cards load; no NaN | ☐ |
| TC-UI-009 | Concurrent sessions | Same user two browsers | Both work until session revoke | ☐ |
| TC-UI-010 | Post-deploy cache | Hard refresh after deploy | Latest UI (not stale bundle) | ☐ |

---

## Section T — Known limitations (do not fail)

These are **documented gaps** — mark **N/A** or note "expected limitation":

| Item | Expected behavior |
|------|-------------------|
| OCR | No auto-extract from uploaded docs |
| Load board | No DAT/Truckstop/external booking |
| GPS/ELD | Simulated tracking only |
| Push notifications | Not implemented |
| Staff workspace UI | Placeholder page for dispatcher/accountant/etc. |
| Driver accept dispatch | Setting exists; no Accept button on driver portal |
| Trip statuses | 4 states only (not full PRD 8-state flow) |
| Auto payroll | Wage preview informational; settlements manual |
| eManifest | Simulated filing — not live CBSA |
| SMS/Email | Simulated unless Twilio/SMTP configured on server |
| Native mobile app | Responsive web only |
| Full GL journal | COA seed only; no double-entry UI |

---

## Sign-off sheet

### Test execution summary

| Field | Value |
|-------|-------|
| Environment | Production — `https://tripsheet.187.124.55.20.sslip.io/` |
| Test period | From: __________ To: __________ |
| Build / deploy tag | __________ |
| Total test cases | ~188 |
| Passed | __________ |
| Failed | __________ |
| Blocked | __________ |

### Defects summary

| Severity | Count | Ticket refs |
|----------|------:|-------------|
| Blocker | | |
| Major | | |
| Minor | | |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA / Tester | | | |
| Engineering lead | | | |
| Product owner | | | |
| Client representative | | | |

### Recommendation

☐ **Approve for production use** — all P0 tests pass  
☐ **Approve with known limitations** — Section T items accepted  
☐ **Not approved** — blockers listed above must be resolved  

---

*End of Production Manual Testing Guide v1.0*
