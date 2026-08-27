# FleetQuix — Chapter 5 Master Data Management (MDM) Plan

**Document type:** Architecture Decision Record (ADR) + Implementation Plan  
**Status:** Complete (Phases 1–8)  
**Version:** 1.8  
**Date:** 2026-08-24  
**Source:** Client Chapter 5 — Master Data Management (`converted 4.md`)  
**Depends on:**

- [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) (complete)
- [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) (complete)
- [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md) (complete)

---

## 0. Why the client wants this (product rationale)

Chapter 5 is **not** about who can log in (Chapter 4) or who may click which button (Chapter 2). It is about **what operational facts the company reuses every day**.

### The pain without MDM

Today, dispatchers and clerks often **re-type** the same broker, shipper address, commodity, or port of entry on every load. That causes:

| Pain | Business impact |
|------|-----------------|
| Duplicate spellings (`ABC Logistics` vs `ABC Logistics Ltd.`) | Broken reports, wrong AR aging, messy customs docs |
| Typos in phone / MC / address | Missed rate cons, failed EDI later, compliance risk |
| Slow dispatch | Every load = mini data-entry job |
| No single source of truth | Accounting, dispatch, and customs disagree on “who the customer is” |
| Hard automation / AI later | Models need stable IDs, not free-text blobs |

### What the client is buying

A **central, company-scoped catalog** of parties, places, assets, and reference lists so every module **selects** instead of **re-creates**. That unlocks:

1. **Speed** — pick broker / location / equipment from a list.  
2. **Accuracy** — one canonical MC#, address, GPS, payment terms.  
3. **History integrity** — archive a broker; old loads still point at the same ID.  
4. **Compliance** — inactive / OOS / blacklisted cannot be chosen for *new* work.  
5. **Cross-border ops** — shared border / POE masters drive ACE/ACI/PAPS/PARS options.  
6. **Future AI / EDI / ERP** — structured masters are the prerequisite (client “AI-ready” note).

**One sentence:** Chapter 5 turns FleetQuix from a form-filler into a **system of record** for freight master data.

---

## 1. What the client is asking for

| Theme | Client requirement |
|--------|-------------------|
| MDM overview | Central reusable business information; select masters instead of retyping |
| Party masters | Customers (shippers), Consignees, Brokers, Carriers (subcontract), Drivers |
| Fleet masters | Trucks, Trailers, Equipment Types |
| Catalog masters | Commodities, Warehouses, Locations (pickup/delivery), Fuel Stations, Maintenance Vendors, Insurance Providers |
| Cross-border | Border Crossings + Ports of Entry (Canada–USA), customs capability flags |
| Finance refs | Payroll Categories, Cost Centers, Custom Reference Data |
| Quality | Unique IDs; duplicate detection + merge suggestions; inactive not selectable for new dispatch |
| I/O | Import/export CSV / Excel / API (EDI / QB / ERP later) |
| Tenancy rule | Masters are **company-specific** (except platform-seeded geography we may share as templates) |
| History rule | Archived masters remain on historical dispatches |

**Acceptance (Chapter 5.21)**

1. **Broker creation** — Save broker → available in dispatch **and** accounting.  
2. **Truck OOS** — Out of Service truck **cannot** be assigned; reason shown.  
3. **Border / POE** — Selecting a port of entry auto-populates customs options (ACE, ACI, PAPS, PARS) and validates required fields before dispatch proceeds.

---

## 2. Current state (baseline after Chapters 2–4)

| Area | Today |
|------|--------|
| Tenancy | Per-company DBs; `companyId` enforced — **keep** |
| RBAC | Persona permissions for drivers/fleet/dispatch/accounting — **extend carefully** if new MDM modules need codes |
| Drivers | **Full** master in `driver-service` (profile, docs, invites, status) |
| Trucks / trailers | **`Asset`** in `fleet-service` (`type` = truck \| trailer \| equipment); unit uniqueness per company |
| Own carrier identity | `CarrierProfile` (company SCAC/DOT for e-manifest) — **not** a multi-carrier catalog |
| Branches | `company_local.Branch` — terminals, **not** freight pickup/delivery MDM |
| Customers / shippers | Free-text (`Invoice.customerName`, manifest JSON) — **no master** |
| Consignees / brokers | Free-text / **missing** |
| Subcontract carriers | **Missing** (only own `CarrierProfile`) |
| Commodities / warehouses / vendors / fuel / insurance / cost centers | **Missing** or free-text / hardcoded |
| Locations | Load `origin`/`destination` strings + static `FREIGHT_LOCATIONS` — **no Location entity** |
| Border / POE | Static `CA_PORTS` / `US_PORTS` in frontend — **not DB**, not company-extensible |
| Equipment types | Asset type enum only — **no catalog** (Dry Van, Reefer, …) |
| Duplicate detection | Local uniqueness only (email, unit No.) — **no fuzzy merge** |
| Import / export | **No** MDM CSV/Excel product |

**Conclusion:** Drivers + Assets are real masters. Almost everything else the client lists is **greenfield** or free-text. Do **not** reopen multi-tenant architecture or rewrite the RBAC persona matrix; add MDM as **tenant operational data** with selective permission additions.

---

## 3. Architecture decisions (lock these)

### 3.1 Chapter 5 is tenant master data — not platform IAM

| Concern | Owner |
|---------|--------|
| Which company DB | Multi-tenant (done) |
| Who may CRUD masters | RBAC (extend catalog only when a module ships) |
| What reusable records exist | **Chapter 5** |

### 3.2 Store masters in the **tenant company database**

Client rule: *“Master records are company-specific.”*

| Data | Store | Why |
|------|--------|-----|
| Customers, Consignees, Brokers, Carriers (3rd party), Locations, Commodities, Warehouses, Vendors, Fuel stations, Cost centers, payroll categories, custom refs | Tenant DB (prefer dedicated schemas / existing service boundaries) | Isolation + company CRUD |
| Drivers | Existing `driver.*` | Already MDM-shaped |
| Trucks / trailers / equipment assets | Existing `fleet.*` Asset | Extend fields/status; don’t fork tables |
| Border crossings / Ports of Entry **seed catalog** | Platform seed (shared read-only templates) **copied or referenced** into tenant on provision **or** global `reference_db` with company overlays | Client wants a built-in CA–US list; companies may still add private notes/favorites |
| Own CBSA identity | Keep `CarrierProfile` | Distinct from “carriers we subcontract” |

**v1 preference:** Prefer extending **existing services** (fleet, driver, company, manifest, accounting) over inventing a sixth “mdm-service” unless CRUD volume forces a split. If we add one service later, it still talks only to the **tenant** connection.

### 3.3 Soft archive + historical FK integrity

- Status: `active` \| `inactive` \| `suspended` / domain-specific (e.g. truck `out_of_service`, broker `blacklisted`).  
- **Never hard-delete** masters referenced by loads/invoices.  
- Inactive / OOS / blacklisted → **blocked on new assignment**; history keeps IDs + denormalized snapshot name optional for display.

### 3.4 Shared **Location** is the address backbone

Client §5.17: every address becomes reusable.

| Decision | v1 |
|----------|-----|
| Canonical place | `Location` (address, lat/lon, TZ, country, province, postal) |
| Parties | Customer / Consignee / Warehouse / FuelStation **link** `locationId` (and optional extra site addresses) |
| Loads | Prefer `originLocationId` / `destinationLocationId` (+ stop location IDs); keep string columns during migration for compatibility |

### 3.5 Duplicate detection is **suggest**, not silent merge

- On create/update: normalize name + key identifiers (MC, DOT, phone, address hash).  
- Surface **merge candidates**; merge is an explicit admin action (audit-logged).  
- Exact unique constraints where safe (e.g. companyId + MC for brokers when MC present).

### 3.6 Import / export

| Wave | Scope |
|------|--------|
| v1 | CSV import/export for priority entities (brokers, customers, locations, commodities) |
| Later | Excel polish, EDI, QuickBooks, ERP |

### 3.7 Explicitly deferred (same spirit as Auth/RBAC)

| Item | Why deferred |
|------|----------------|
| Live fuel pricing | Client marked “Future” |
| EDI / QB / ERP import | Client “Future” |
| AI auto-merge / auto-create from emails | Needs stable masters first |
| Full insurance policy management | Provider master + asset expiry link is enough for v1 |
| Replacing Driver/Asset UIs wholesale | Align & extend; don’t rebuild Chapter 5 as a greenfield fleet app |
| Reopening tenancy or 300+ permission redesign | Out of scope |

---

## 4. Gap map (Chapter 5 section → plan)

| § | Topic | Status vs codebase | Plan phase |
|---|--------|-------------------|------------|
| 5.1–5.2 | MDM overview / module list | Conceptual only | All |
| 5.3 | Customers (shippers) | Free-text | **2** |
| 5.4 | Consignees | Free-text JSON | **2** |
| 5.5 | Brokers | Missing | **2** (acceptance #1) |
| 5.6 | Carriers (subcontract) | Only own `CarrierProfile` | **3** |
| 5.7–5.8 | Trucks / trailers | Asset exists; field/status gaps | **1** (acceptance #2) |
| 5.9 | Drivers | Strong | **1** (align status/rules only) |
| 5.10 | Commodities | Free-text | **4** |
| 5.11 | Equipment types | Enum only | **1 / 4** |
| 5.12 | Warehouses | Missing | **4** |
| 5.13–5.14 | Border / POE | Static FE lists | **5** (acceptance #3) |
| 5.15 | Fuel stations | Missing | **6** |
| 5.16 | Maintenance vendors | Free-text | **6** |
| 5.17 | Locations | Strings + static hubs | **2** (foundation) |
| 5.18 | Duplicate detection | Missing | **2–3** (parties), extend later |
| 5.19 | Import / export | CSV for brokers, customers, locations, commodities | **7** |
| 5.20 | Business rules | Partial | Cross-cutting each phase |
| 5.21 | Acceptance | **Proven** (Phase 8) | **8** |
| — | Insurance providers / payroll categories / cost centers / custom refs | Missing / weak | **6** (thin) or later |

---

## 5. Proposed data model (conceptual)

Tenant-scoped (illustrative — exact Prisma/SQL in implementation):

```text
Location
  id, companyId, name?, line1, line2?, city, region, postal, country
  lat, lon, timeZone, status, normalizedKey, createdAt, archivedAt?

Customer (shipper)
  id, companyId, code?, legalName, dba?, status
  creditLimit?, paymentTerms?, currency?, taxExempt?
  billingLocationId?, defaultCommodityId?, notes?, contacts Json?

Consignee
  id, companyId, name, locationId?, contact?, hours?, dock?, appointmentRequired
  liftgate?, hazmatOk?, instructions?, status

Broker
  id, companyId, name, mc?, dot?, scac?, status  // active|inactive|blacklisted|watch
  contacts Json?, paymentTerms?, factoring?, rateConfEmail?, docsRequired?

Carrier (subcontract)
  id, companyId, name, mc?, dot?, insuranceExpiry?, safetyRating?, status, equipmentNotes?

Commodity
  id, companyId, name, nmfc?, hazmat, tempMin?, tempMax?, weightLimit?, status

EquipmentType
  id, companyId | platformSeed, code, name  // Dry Van, Reefer, …

Warehouse
  id, companyId, name, locationId?, hours Json?, docks?, appointmentRules?, status

BorderCrossing / PortOfEntry
  platform seed (+ optional company overlay favorites/notes)
  codes, hours, GPS, FAST lane, ACE/ACI/PAPS/PARS flags, restrictions

FuelStation, MaintenanceVendor, InsuranceProvider
  companyId, name, locationId?, attributes, status

CostCenter, PayrollCategory, ReferenceData (key/value sets)
  companyId, code, name, meta Json?, status

DuplicateCandidate (optional)
  entityType, leftId, rightId, score, status (suggested|dismissed|merged)
```

**Drivers / Assets:** extend existing models (status enums, assignment gates, richer compliance fields) rather than parallel tables.

---

## 6. Service & UI placement (v1)

| Domain | Likely home | UI |
|--------|-------------|-----|
| Location + parties (Customer, Consignee, Broker, Carrier) | New tenant module under **company-service** *or* small **mdm** Nest app on tenant pool | Company app → **Master Data** section |
| Drivers | driver-service (existing) | Existing Drivers tab (align) |
| Assets / OOS gate | fleet-service | Existing Assets + Dispatch assignment |
| Commodities / EquipmentType / Warehouse | company MDM module | Master Data catalogs |
| Border / POE seed | company provision SQL + manifest consume | Dispatch / e-manifest pickers |
| Vendors / fuel / insurance / cost centers | MDM module (thin) | Master Data + FleetOps vendor picker |
| Import/export | Same owning service + gateway routes | Master Data → Import / Export |

**RBAC:** Prefer mapping to existing `fleet.*`, `drivers.*`, `dispatch.*`, `accounting.*` where possible. Add a small `mdm.*` or `parties.*` permission group when Master Data UI ships (document in phase note; **do not** redesign Chapter 2 personas).

---

## 7. Implementation phases (do not start until approved)

### Phase 0 — Foundations (planning already this doc)

- [x] ADR + gap map + lock-ins  
- [x] Confirm service home (fleet-service + tenant `fleet` schema for Phase 1; parties MDM later)  
- [x] Confirm platform seed strategy for Border/POE (**Phase 5** — tenant seed copy of CA–US ports)  

### Phase 1 — Fleet & driver alignment (acceptance #2)

- [x] Normalize Asset status to include **Out of Service** (and map Available / Assigned / Maintenance / Retired)  
- [x] **Block** dispatch/fleet assignment of OOS (and inactive) assets with clear reason  
- [x] EquipmentType seed list (system defaults + company overrides)  
- [x] Driver master: ensure inactive/suspended drivers cannot be newly assigned (align with existing status)  
- [x] Audit assignment denials  

See [MDM-PHASE-1-COMPLETE.md](./MDM-PHASE-1-COMPLETE.md).

### Phase 2 — Locations + party core (acceptance #1 foundation)

- [x] `Location` CRUD + pickers  
- [x] `Broker` CRUD + status (active / inactive / blacklisted / watch)  
- [x] `Customer` (shipper) + `Consignee` CRUD  
- [x] Wire Broker into **dispatch create** and **accounting** party selectors  
- [x] Duplicate detection on party create (name + MC/DOT/phone) → suggest merge  
- [x] Inactive parties not selectable for **new** dispatches  

See [MDM-PHASE-2-COMPLETE.md](./MDM-PHASE-2-COMPLETE.md).

### Phase 3 — Subcontract carriers + deeper party use

- [x] `Carrier` (3rd party) master distinct from `CarrierProfile`  
- [x] Optional link loads to carrierId when subcontracting  
- [x] Merge UX for suggested duplicates  

See [MDM-PHASE-3-COMPLETE.md](./MDM-PHASE-3-COMPLETE.md).

### Phase 4 — Catalogs

- [x] Commodities  
- [x] Warehouses (on Locations)  
- [x] Replace free-text commodity on manifests/loads with optional FK + display snapshot  

See [MDM-PHASE-4-COMPLETE.md](./MDM-PHASE-4-COMPLETE.md).

### Phase 5 — Border & Ports (acceptance #3)

- [x] Seed Border Crossing + Port of Entry masters (CA–US set from client examples)  
- [x] Dispatch / manifest: selecting POE populates ACE/ACI/PAPS/PARS capability flags  
- [x] Validate required customs fields before dispatch can proceed when cross-border  

See [MDM-PHASE-5-COMPLETE.md](./MDM-PHASE-5-COMPLETE.md).

### Phase 6 — Ops / finance reference (thin)

- [x] Maintenance vendors (replace free-text on maintenance records)  
- [x] Fuel stations (no live pricing)  
- [x] Insurance providers (link optional on assets)  
- [x] Cost centers / payroll categories / generic ReferenceData (minimal viable)  

See [MDM-PHASE-6-COMPLETE.md](./MDM-PHASE-6-COMPLETE.md).

### Phase 7 — Import / export

- [x] CSV import/export for Brokers, Customers, Locations, Commodities  
- [x] Dry-run validation + error report  
- [x] Permission-gated routes  

See [MDM-PHASE-7-COMPLETE.md](./MDM-PHASE-7-COMPLETE.md).  

### Phase 8 — Tests + docs

- [x] Architecture suite covering 5.21 (broker available, OOS blocked, POE customs options)  
- [x] `MDM-CHAPTER-5-COMPLETE.md`  
- [x] Update Security/product copy only if claims change (Master Data gates; Security MFA/SSO unchanged)  

See [MDM-PHASE-8-COMPLETE.md](./MDM-PHASE-8-COMPLETE.md) + [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md).  

---

## 8. UI / product shape (target)

- **Master Data** nav (company app): Parties · Places · Catalogs · Cross-border · Import  
- **Dispatch**: pickers for broker, customer, consignee, locations, equipment type, POE  
- **Accounting**: customer/broker selectors instead of raw names (migration path for old invoices)  
- **Assets / Drivers**: keep existing tabs; harden status gates  
- **Super Admin**: optional manage **platform** border/POE seed only — not company brokers  

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Big-bang rewrite of Load/Manifest JSON | Dual-write: IDs + snapshot strings; migrate pickers first |
| Permission sprawl | Small `mdm.*` / `parties.*` set; map personas once |
| Duplicate false positives | Suggest-only; tunable thresholds; dismiss + audit |
| Platform vs tenant border data | Seed read-only globals; company may favorite, not edit official codes in v1 |
| Scope creep (EDI, fuel prices, AI merge) | Hard deferred table |
| Overlap with Branches | Branches = org terminals; Locations = freight addresses — keep separate |

---

## 10. Exit criteria for **planning** (this step)

- [x] ADR written from Chapter 5 vs current multi-tenant + RBAC + Auth baseline  
- [x] Why-client / product rationale documented  
- [x] Lock-ins confirmed (tenant masters, Location backbone, soft archive, suggest-merge, deferred EDI/fuel AI)  
- [x] Phases 0–8 accepted as implementation order  
- [x] Phase 1 implemented — see [MDM-PHASE-1-COMPLETE.md](./MDM-PHASE-1-COMPLETE.md)  
- [x] Phase 2 implemented — see [MDM-PHASE-2-COMPLETE.md](./MDM-PHASE-2-COMPLETE.md)  
- [x] Phase 3 implemented — see [MDM-PHASE-3-COMPLETE.md](./MDM-PHASE-3-COMPLETE.md)  
- [x] Phase 4 implemented — see [MDM-PHASE-4-COMPLETE.md](./MDM-PHASE-4-COMPLETE.md)  
- [x] Phase 5 implemented — see [MDM-PHASE-5-COMPLETE.md](./MDM-PHASE-5-COMPLETE.md)  
- [x] Phase 6 implemented — see [MDM-PHASE-6-COMPLETE.md](./MDM-PHASE-6-COMPLETE.md)  
- [x] Phase 7 implemented — see [MDM-PHASE-7-COMPLETE.md](./MDM-PHASE-7-COMPLETE.md)  
- [x] Phase 8 implemented — see [MDM-PHASE-8-COMPLETE.md](./MDM-PHASE-8-COMPLETE.md) + [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md)

---

## 11. What we will **not** do until a phase is approved

- No MDM schema migrations  
- No new Master Data nav  
- No EDI / QuickBooks / live fuel pricing  
- No silent auto-merge of parties  
- No reopening multi-tenant DB-per-company or Chapter 2 permission redesign  

---

## 12. Suggested first implementation slice (when approved)

**Phase 1 (Fleet OOS + assignment gate)** unlocks acceptance #2 with existing Assets, low schema risk.

Then **Phase 2 (Location + Broker + Customer/Consignee)** unlocks acceptance #1 and the “select don’t type” core.

**Phase 5** closes acceptance #3 once parties/locations exist for dispatch to hang customs validation on.

---

## Related docs

- Client source: `converted 4.md` (Chapter 5 MDM)  
- [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)  
- [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md)  
- [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)  
- [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md)  
