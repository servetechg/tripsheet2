# FleetQuix — Chapter 6 Driver Management Plan

**Document type:** Architecture Decision Record (ADR) + Implementation Plan  
**Status:** Complete — Phases 1–9 implemented  
**Version:** 1.0  
**Date:** 2026-08-28  
**Source:** Client Chapter 6 — Driver Management (`converted 5.md`)  
**Depends on:**

- [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) (Phases 0–6 complete)
- [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) (complete)
- [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md) (complete)
- [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md) (complete)

---

## 0. Why the client wants this (product rationale)

Chapters 2–5 answered **who may log in**, **who may do what**, and **what reusable business data exists**. Chapter 6 answers a different question:

> **Who is allowed to move freight, with what credentials, on what equipment, at what pay — and are they compliant right now?**

### The pain without a driver system of record

| Pain | Business impact |
|------|-----------------|
| Driver data scattered (HR spreadsheet, dispatcher notes, payroll clerk memory) | Wrong person assigned; payroll disputes |
| Expired licence / medical discovered **after** dispatch | Compliance exposure, insurance risk, rejected at border |
| No formal hire → active → suspend → terminate flow | Terminated drivers still in pickers; audit failures |
| Wage terms disconnected from settlements | Manual re-keying; incorrect driver pay |
| Equipment “who had unit 104 last week?” unknown | Maintenance blame games; DVIR gaps |
| Dispatchers see all drivers, including on vacation / suspended | Operational noise; policy violations |
| Customs eligibility checked manually | Cross-border loads assigned to ineligible drivers |

### What the client is buying

A **360° driver master record** that every downstream module references:

1. **Dispatch** — only qualified, available, active drivers on new loads  
2. **Payroll / settlements** — wage configuration tied to the same person  
3. **Compliance** — document expiry, safety history, training due dates  
4. **Customs / eManifest** — border eligibility derived from passport, FAST, work auth, medical  
5. **Fleet** — equipment assignment history per driver  
6. **Driver self-service** — one dashboard for sheets, docs, contract, active load  
7. **Future AI** — performance scorecards need structured history (miles, OTP, incidents)

**One sentence:** Chapter 6 makes the **driver** a first-class operational entity — not just a login with a few uploaded PDFs.

---

## 1. What the client is asking for

| Theme | Client requirement (§) |
|--------|-------------------------|
| Driver as hub | Every dispatch, payroll, compliance, doc, inspection, accident, training, performance metric references **Driver Master Record** (§6.1) |
| Lifecycle | Prospect → Invited → … → Active → On Trip → Suspended → Terminated → **Archived**; never hard-delete history (§6.3) |
| Driver types | Company, Owner-Operator, Team, Relief, Temporary, Seasonal (§6.4) |
| Profile | Personal, contact, address, emergency contact (§6.5) |
| Employment | Employee #, type, branch, hire/probation dates, status, manager, dispatcher assignment (§6.6) |
| Wage | Per mile, hourly, salary, % load, hybrid; bonuses & deductions (§6.7) |
| Qualifications | Licence class, endorsements, hazmat, medical, passport, FAST, etc. with issue/expiry/OCR (§6.8) |
| Documents | 17+ doc types; OCR, version history, signature, expiry, approval, audit (§6.9) |
| Availability | Real-time status; dispatch sees **Available** by default (§6.10) |
| Equipment | Primary/secondary truck & trailer, ELD, fuel card, etc.; **history retained** (§6.11) |
| Performance | Miles, OTP, fuel, safety score, ratings — AI score later (§6.12) |
| Safety | Accidents, violations, coaching (§6.13) |
| Training | Courses, completion/expiry, certificates (§6.14) |
| Customs | CA→US eligibility rules; block dispatch unless override (§6.15) |
| Driver dashboard | Current/next dispatch, equipment, payroll summary, alerts (§6.16) |
| Search | Name, ID, licence, branch, status, FAST, hazmat, expiring docs (§6.17) |
| Business rules | Unique ID; no delete; expired mandatory docs block dispatch; suspended cannot login (§6.18) |

**Acceptance (§6.19)**

1. **Driver activation** — HR approves → mandatory onboarding complete → status **Active** → available for dispatch.  
2. **Dispatch validation** — Expired medical → assignment **blocked**, qualification highlighted, attempt **logged**.  
3. **Equipment assignment** — New truck assignment closes previous, activates new, **full history retained**.

---

## 2. Current state (baseline after Chapters 2–5)

| Area | Today |
|------|--------|
| Tenancy | Driver rows in tenant `driver` schema; `companyId` enforced — **keep** |
| RBAC | Catalog includes `drivers.approve`, `drivers.suspend`, `drivers.archive`, wage/doc permissions — **partially wired** |
| Auth | Suspended **users** blocked at login (Chapter 4); driver `active` boolean **not** linked to auth status |
| Master record | `Driver` model: name, email, phone, dob, licenceNo, citizenship, address, emergency, fastCard, sin, notes, `branchId`, `active` |
| Lifecycle | Invite → onboard → `active: true`; **no** prospect/HR review/approved/suspended/terminated enum |
| Driver types | **Not modeled** (all treated as company driver) |
| Employment | No employee #, hire date, probation, manager, dispatcher assignment |
| Qualifications | Flat `licenseNo` + document uploads — **no** structured qualification rows (class, endorsements, hazmat cert #) |
| Documents | 17 types via `DriverDocument`; Cloudinary; expiry field on upload; **no** server-side expiry status job; **no** OCR/versioning/approval workflow |
| Wage | `Contract` model + `AdminWageModal`; pay types in shared catalog; settlements **manual**, not rate-driven |
| Dispatch gate | `GET /drivers/:id/dispatch-ready` (license, abstract, medical); FE calls it; **fleet-service does not** enforce server-side |
| Availability | UI pill: in-transit vs available from **load status** — not a driver field or calendar |
| Equipment | Driver on **Load** only; **no** default truck/trailer on driver; **no** assignment history table |
| Performance | Trip/load counts on profile — **no** KPI engine |
| Safety / training | Contract boilerplate only — **no** incident or training entities |
| Customs | `fastCard` field + `border_doc` type — **no** eligibility rules on dispatch/manifest |
| Search | **None** on Drivers tab |
| Owner-operator | **Not modeled** (corp name, GST, settlement terms) |
| Audit | Generic `AuditEvent` exists — dispatch block attempts **not** consistently logged |

**Conclusion:** FleetQuix has a **solid v1 driver onboarding + docs + wage contract + dispatch doc gate (FE)**. Chapter 6 is **extend and formalize**, not greenfield — but the gap to the client spec is **large** for lifecycle, qualifications, availability, equipment history, performance, safety, and training.

---

## 3. Architecture decisions (lock these)

### 3.1 Chapter 6 extends driver-service — no new microservice v1

| Decision | v1 |
|----------|-----|
| Home | **`driver-service`** (+ tenant `driver` schema) |
| Documents / contracts | Stay in driver-service (already there) |
| Equipment assignment history | **driver-service** (driver-centric) with optional read from fleet-service `Asset` |
| Performance KPIs | **Computed views** from fleet loads + tripsheet data (read-only); no separate analytics DB |
| Safety / training | New tenant tables in `driver` schema (thin v1) |
| Auth user link | Keep `Driver.userId` → `auth_db`; status changes **sync** suspend/archive to auth user when linked |

### 3.2 Lifecycle status replaces `active` boolean

| Status | Can login? | Selectable on new dispatch? |
|--------|------------|----------------------------|
| `invited` | No (until onboard) | No |
| `pending_review` | No | No |
| `approved` | Optional (config) | No until → `active` |
| `active` | Yes | Yes (if compliant + available) |
| `on_leave` / `vacation` | Yes (optional) | No by default |
| `suspended` | **No** | No |
| `terminated` | No | No |
| `archived` | No | No |

- **Never hard-delete** drivers with history (loads, sheets, settlements, docs).  
- Migration: map `active: false` → `suspended` or `archived` based on operator choice.

### 3.3 Qualifications vs documents

| Layer | Purpose |
|-------|---------|
| **DriverDocument** | File evidence (PDF/image), expiry, Cloudinary — **keep** |
| **DriverQualification** (new) | Structured credential: type, number, class, endorsements, issue/expiry, issuing authority, status |

Dispatch/manifest gates consult **qualifications + mandatory docs**, not filenames alone.

### 3.4 Compliance gates are server-side (non-negotiable)

| Gate | Enforcer |
|------|----------|
| Driver status / suspended | **fleet-service** on load assign (via driver-service) |
| Mandatory docs / expired medical | **fleet-service** calls driver-service `dispatch-ready` or shared validator |
| Customs eligibility (cross-border load) | **fleet-service** + **manifest-service** on save/submit |
| Manager override | Explicit permission + audit event (e.g. `dispatch.override_compliance`) — **new permission** |

Frontend-only checks (today) are **insufficient** for acceptance §6.19 #2.

### 3.5 Equipment assignment history

```text
DriverEquipmentAssignment
  id, companyId, driverId, assetId, assetType (truck|trailer|eld|…)
  role (primary|secondary)
  assignedAt, unassignedAt?, assignedBy?, notes?
```

Closing prior primary assignment when a new primary is saved (acceptance #3).

### 3.6 Availability v1 = status + load-derived busy flag

Full calendar / HOS integration is **deferred**. v1:

- `availabilityStatus` enum on Driver (`available`, `unavailable`, `on_dispatch`, `off_duty`, `vacation`, `medical_leave`, `training`, …)  
- Dispatch picker default filter: `active` + `available` + dispatch-ready + not on active load  
- Override filter explicit in UI (client §6.10)

### 3.7 Explicitly deferred (client “Future” or out of v1 scope)

| Item | Why deferred |
|------|----------------|
| AI performance score 0–100 | Client §6.12 “Future AI” |
| TWIC, HOS violations | Client “Future” |
| Full OCR pipeline | Flag fields + manual entry v1; OCR service later |
| Document version history & digital signature workflow | Contract sign exists; full doc versioning later |
| Contract driver type | Client “Future” |
| Real-time GPS availability / ELD integration | Needs telematics partner |
| Team driver pairing model | Phase after owner-operator basics |
| Garnishments / advanced payroll deductions engine | Accounting scope |

---

## 4. Gap map (Chapter 6 section → plan phase)

| § | Topic | Status vs codebase | Phase |
|---|--------|-------------------|-------|
| 6.1–6.2 | Overview / objectives | Conceptual | All |
| 6.3 | Lifecycle | Invite + `active` only | **1** (acceptance #1) |
| 6.4 | Driver types | Missing | **3** |
| 6.5–6.6 | Profile / employment | Partial profile | **2–3** |
| 6.7 | Wage configuration | Contract exists; settlements disconnected | **4** (thin) |
| 6.8 | Qualifications | licenceNo + docs only | **2** (acceptance #2) |
| 6.9 | Documents | Strong upload; weak expiry/OCR/approval | **2** |
| 6.10 | Availability | Load-derived UI only | **5** |
| 6.11 | Equipment assignment | Load-only | **6** (acceptance #3) |
| 6.12 | Performance | Counts only | **7** (read-only KPIs) |
| 6.13 | Safety | Missing | **7** (thin) |
| 6.14 | Training | Missing | **7** (thin) |
| 6.15 | Customs eligibility | fastCard + doc type | **5** |
| 6.16 | Driver dashboard | Sheets/docs/contract/load | **8** (enhance alerts) |
| 6.17 | Search & filters | Missing | **8** |
| 6.18 | Business rules | Partial | Cross-cutting |
| 6.19 | Acceptance | Not proven | **9** |

---

## 5. Proposed data model (conceptual)

Tenant-scoped in `driver` schema:

```text
Driver (extend existing)
  + employeeNumber?, driverType (company|owner_operator|team|relief|temporary|seasonal)
  + lifecycleStatus (enum above) — replaces active boolean
  + employmentStatus?, hireDate?, probationEndDate?, seniorityDate?
  + branchId → company_local.Branch
  + managerUserId?, dispatcherUserId?
  + preferredName?, gender?, preferredLanguage?
  + availabilityStatus?
  + ownerOperatorProfile Json?  (corp, gst, insurance refs — phase 3)

DriverQualification (new)
  id, companyId, driverId
  type (license|medical|passport|fast|hazmat|work_permit|…)
  number?, class?, endorsements Json?
  issueDate?, expiryDate?, issuingAuthority?
  documentId? → DriverDocument
  status (valid|expiring_soon|expired|missing)
  ocrData Json?

DriverEquipmentAssignment (new)
  id, companyId, driverId, assetId, assetType, role
  assignedAt, unassignedAt?, assignedByUserId?, notes?

DriverSafetyEvent (new, thin)
  id, companyId, driverId, type, occurredAt, description, preventable?, status

DriverTrainingRecord (new, thin)
  id, companyId, driverId, courseCode, completedAt, expiryDate?, certificateDocumentId?

DriverPerformanceSnapshot (optional materialized or view)
  companyId, driverId, period, miles, loadedMiles, revenue, otpPct, … — computed
```

**Keep:** `DriverDocument`, `Contract`, `Invite` — extend, do not replace.

---

## 6. Service & UI placement (v1)

| Capability | Service | UI |
|------------|---------|-----|
| Lifecycle approve/suspend/archive | driver-service + auth sync | DriversTab + DriverProfile actions (HR) |
| Qualifications CRUD | driver-service | DriverProfile → Qualifications tab |
| Documents | driver-service (existing) | DriverProfile + onboarding |
| Wage / contract | driver-service (existing) | AdminWageModal |
| Dispatch / customs gates | fleet-service, manifest-service | DispatchTab, EManifestForm |
| Equipment assignment | driver-service | DriverProfile → Equipment tab |
| Availability | driver-service | DriversTab filter + profile edit |
| Safety / training | driver-service | DriverProfile tabs (thin) |
| Performance KPIs | driver-service read + fleet/tripsheet joins | DriverProfile + Reports |
| Search | driver-service query params | DriversTab toolbar |

**RBAC:** Use existing `drivers.*` codes; add only if needed:

- `drivers.approve` — HR activate  
- `drivers.suspend` / `drivers.archive` — already in catalog  
- `dispatch.override_compliance` — manager override (new, gateway)  

Do **not** reopen Chapter 2 persona matrix.

---

## 7. Implementation phases (do not start until approved)

### Phase 1 — Lifecycle & auth sync (acceptance #1)

- [x] Replace `active` boolean with `lifecycleStatus` enum + migration  
- [x] HR **Approve** flow: `pending_review` → `active` (requires mandatory docs checklist)  
- [x] **Suspend** / **terminate** / **archive** actions; sync auth user status  
- [x] Wire `drivers.approve`, `drivers.suspend`, `drivers.archive` in UI + API  
- [x] Block suspended/terminated drivers from login (auth) and dispatch pickers  

### Phase 2 — Qualifications & compliance engine (acceptance #2)

- [x] `DriverQualification` model + CRUD API  
- [x] Expiry computation (`valid` / `expiring_soon` / `expired`) on read or nightly job  
- [x] Extend `dispatch-ready` to use qualifications + docs  
- [x] **fleet-service** server-side enforcement on load create/update  
- [x] Audit log on blocked assignment (`compliance.dispatch_blocked`)  
- [x] Expiry notifications (reuse notification-service queue)  

### Phase 3 — Employment profile & driver types

- [x] Driver type enum + owner-operator extended fields (minimal)  
- [x] Employment fields: employee #, hire dates, branch, manager/dispatcher links  
- [x] Extend invite/onboarding to capture missing employment fields  
- [x] Map `branchId` in AppDataContext / UI  

### Phase 4 — Wage ↔ payroll alignment (thin)

- [x] Surface contract pay model on settlement preview (read contract; no auto-pay v1)  
- [x] Link settlement lines to trip sheets where IDs exist  
- [x] Document gap for full rate engine (explicit deferral)  

### Phase 5 — Availability & customs eligibility

- [x] `availabilityStatus` on Driver; admin edit + driver self-service (limited)  
- [x] Dispatch picker: default **Available + compliant** filter; explicit “show all”  
- [x] Cross-border eligibility rules (passport, medical, work auth, FAST recommended)  
- [x] Manifest driver picker respects same rules  

### Phase 6 — Equipment assignment history (acceptance #3)

- [x] `DriverEquipmentAssignment` CRUD  
- [x] Assign primary truck/trailer from DriverProfile; auto-close prior primary  
- [x] Show assignment timeline on profile  
- [x] Optional: pre-fill dispatch truck/trailer from driver primary  

### Phase 7 — Safety, training & performance (thin)

- [x] CRUD for safety events and training records (minimal fields)  
- [x] Performance snapshot API: miles, loads delivered, OTP from existing load data  
- [x] DriverProfile summary cards  

### Phase 8 — Search, dashboard & UX polish

- [x] DriversTab search/filter (name, email, licence, status, expiring docs, branch)  
- [x] Driver dashboard: upcoming expirations, compliance alerts, payroll summary link  
- [x] Revoke/regenerate invite buttons wired to existing API  

### Phase 9 — Acceptance suite & close-out

- [x] In-process tests: lifecycle transitions, dispatch block on expired medical, equipment history  
- [x] Live architecture test script (gateway + driver + fleet)  
- [x] `DRIVER-CHAPTER-6-COMPLETE.md` ADR  
- [x] Manual UAT checklist for client  

---

## 8. Chapter 6.19 acceptance — how we will prove it

| # | Requirement | Proof |
|---|-------------|-------|
| 1 | HR approve → Active → dispatch available | Live: onboard driver → `pending_review` → approve → appears in dispatch picker + `dispatch-ready: true` |
| 2 | Expired medical blocks dispatch + logged | Live: set medical expired → POST/PATCH load with driver → 403 + audit event; FE shows reason |
| 3 | Equipment assignment history | Live: assign truck A → assign truck B → history shows A closed, B active |

---

## 9. Dependencies & risks

| Risk | Mitigation |
|------|------------|
| `userId` vs `driverRecordId` confusion in loads/sheets | Continue `driverIds.ts` bridging; fleet APIs accept driver-service id |
| FE-only dispatch gate today | Phase 2 **requires** fleet-service enforcement |
| Scope creep (AI, OCR, HOS) | Lock deferrals in §3.7; phase gates |
| Auth sync on suspend | Reuse Chapter 4 `setUserStatus` / tokenVersion bump |

---

## 10. What we will **not** do in Chapter 6 v1

- Replace Drivers UI from scratch  
- Build OCR / AI performance scoring  
- Full owner-operator accounting / GST filing  
- ELD telematics integration  
- Reopen multi-tenant, RBAC catalog redesign, or MDM party masters  

---

## 11. Next step

**Review and approve this plan.** Implementation proceeds **phase by phase** only after explicit sign-off (same workflow as Chapters 2–5).

When Phase 1 is approved, first deliverables:

1. Prisma migration for `lifecycleStatus`  
2. Approve / suspend / archive API + UI  
3. Auth sync for suspended drivers  

---

**End of Chapter 6 Plan (v1.0)**
