# Chapter 5 — Master Data Management (MDM): Full Testing Guide

**Version:** 1.0  
**Date:** 2026-08-29  
**Scope:** Parties, catalogs, ports, assets status, CSV I/O, dispatch/accounting pickers, cross-border gates (Phases 1–8).

Related: [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md) · [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md) · [MULTI-TENANT-TESTING-GUIDE.md](./MULTI-TENANT-TESTING-GUIDE.md)

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

**Verify:** Gateway `:3000`, company `:3002`, fleet `:3004`.

### 1.2 Apply migrations & tenant MDM SQL

```powershell
cd C:\other-projects\tripsheet\backend\services\company-service
npx prisma migrate deploy

cd C:\other-projects\tripsheet\backend\services\fleet-service
npx prisma migrate deploy

cd C:\other-projects\tripsheet\backend\services\accounting-service
npx prisma migrate deploy
```

**Existing tenants** (MKX): apply MDM SQL via schema migrate:

```http
POST http://localhost:3000/api/tenants/schema-migrate-all
Authorization: Bearer <super-admin-token>
```

MDM tenant SQL files: `009`–`014` (brokers, ports, commodities, vendors, etc.) via `ensureMdm*` / provisioning.

Accounting migration for invoice broker link: `20260824120000_mdm_phase8_invoice_broker`.

### 1.3 Test accounts

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| MKX Owner | `admin@mkx.ca` | `mkx123` | Master data CRUD, import/export |
| Dispatcher | (create via Users) | — | Dispatch pickers |
| Accountant | (create via Users) | — | Invoice broker picker |

**Permissions:** Mutating MDM uses `company.edit` / `company.locations` (and related company admin grants).

---

## 2. Automated tests (run first)

### 2.1 In-process acceptance (Chapter 5.21)

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:mdm
```

Runs:

| Suite | What it validates |
|-------|-------------------|
| `company-service/check-chapter5-acceptance.ts` | Broker selectable on dispatch + accounting pickers; inactive/blacklisted blocked; POE → ACE/ACI/PAPS/PARS flags |
| `fleet-service/check-chapter5-acceptance.ts` | Out-of-service asset blocked; cross-border field validation |

### 2.2 Fleet Jest (load assignment gates)

```powershell
cd C:\other-projects\tripsheet\backend\services\fleet-service
npm test -- --testPathPatterns=loads.service.spec
```

Covers: OOS truck rejection, dispatch-ready integration, cross-border validation.

### 2.3 Combined bundle

```powershell
cd C:\other-projects\tripsheet\backend
npm run test:mdm:all
```

Includes RBAC in-process + fleet Jest (see `backend/package.json`).

---

## 3. Manual UI testing — by feature

Path: **Company → Master data** tab (`MasterDataPanel.tsx`).  
Consumption: **Dispatch**, **eManifest**, **Accounting** pickers.

### Phase 1 — Asset status & assignment gate

| # | Steps | Expected result |
|---|--------|-----------------|
| 1.1 | **Assets** → add truck unit `T-101` | Asset created |
| 1.2 | Set status **Out of Service** | Status badge shows OOS |
| 1.3 | **Dispatch** → assign load → pick truck T-101 | **Blocked** with OOS reason |
| 1.4 | Set truck **Available** | Assign succeeds |
| 1.5 | Equipment tab → non-truck unit types | EquipmentType catalog available |

---

### Phase 2 — Parties (locations, brokers, customers, consignees)

| # | Steps | Expected result |
|---|--------|-----------------|
| 2.1 | Master data → **Brokers** → add “ABC Logistics” (active) | Broker saved |
| 2.2 | **Dispatch** → new load → Broker dropdown | ABC Logistics listed |
| 2.3 | **Accounting** → new invoice → **Broker (master)** | Same broker listed |
| 2.4 | Set broker **inactive** | Hidden from new dispatch/invoice pickers |
| 2.5 | Set broker **blacklisted** | Not selectable; reason if forced via API |
| 2.6 | Master data → **Locations** → add shipper/consignee cities | Appear in dispatch stop pickers |
| 2.7 | Master data → **Customers** / **Consignees** | CRUD + status filters work |

**Duplicate suggestions:** Creating near-duplicate name may show suggest-only hint (no auto-merge).

---

### Phase 3 — Subcontract carriers & merge

| # | Steps | Expected result |
|---|--------|-----------------|
| 3.1 | Master data → **Carriers** → add subcontract carrier | Distinct from own **Carrier profile** (Company profile) |
| 3.2 | Dispatch → assign **subcontract carrier** on load | `Load.carrierId` set |
| 3.3 | Explicit merge API (advanced) | `POST …/mdm/merge` — audited; source archived |

---

### Phase 4 — Commodities & warehouses

| # | Steps | Expected result |
|---|--------|-----------------|
| 4.1 | Master data → **Commodities** → add “General freight” | Saved |
| 4.2 | Dispatch / eManifest → commodity picker | Commodity listed |
| 4.3 | Master data → **Warehouses** | CRUD works |
| 4.4 | Inactivate commodity | Not selectable for new loads |

---

### Phase 5 — Border crossings & ports of entry

| # | Steps | Expected result |
|---|--------|-----------------|
| 5.1 | Master data → **Ports of entry** | CA–US seed ports visible (e.g. Sweetgrass 3505, Coutts 0407) |
| 5.2 | Dispatch → enable **Cross-border** → select US port | ACE + PAPS flags auto-set |
| 5.3 | Select CA port | ACI + PARS flags auto-set |
| 5.4 | Choose wrong program (ACI at US port) | Validation error before save |
| 5.5 | eManifest → same port selection | ACE/ACI/PAPS/PARS populated on form |
| 5.6 | Submit cross-border load without POE | Blocked |
| 5.7 | Inactivate port | Cannot select for new cross-border loads |

---

### Phase 6 — Ops & finance catalogs

| # | Steps | Expected result |
|---|--------|-----------------|
| 6.1 | Master data → **Vendors** | Vendor CRUD |
| 6.2 | **Fuel stations** | Location only — no live pricing fields |
| 6.3 | **Insurance** on assets | Policy refs on asset records |
| 6.4 | **Cost centers** / **Payroll cats** / **Reference** | Catalog lists + status |

---

### Phase 7 — CSV import / export

| # | Steps | Expected result |
|---|--------|-----------------|
| 7.1 | Master data → **Import / export** → entity **brokers** | UI loads |
| 7.2 | **Dry-run** CSV with header row + 2 brokers | Preview report; no commit |
| 7.3 | **Import** valid CSV | Rows created |
| 7.4 | Import CSV with errors | Error report; valid rows optional per mode |
| 7.5 | **Export** brokers | CSV downloads |
| 7.6 | Repeat for **customers**, **locations**, **commodities** | Same pattern |

**Sample CSV (brokers):**

```csv
name,status,phone,email
Test Broker Inc,active,403-555-0100,broker@example.com
Watch List LLC,watch,403-555-0200,watch@example.com
```

---

### Phase 8 — End-to-end MDM consumption

| # | Steps | Expected result |
|---|--------|-----------------|
| 8.1 | Create broker → create load with broker → create invoice with same broker | Shared `brokerId` + name snapshot on both |
| 8.2 | OOS truck + cross-border load | Both gates fire with clear messages |
| 8.3 | Dispatcher without `company.edit` | Master data tab hidden or read-only |

---

## 4. API reference (gateway `:3000`)

Company-scoped MDM routes (typical prefix `/api/companies/:companyId/…`). All need bearer + tenant context.

### Parties & catalogs

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/companies/:id/locations` | Locations |
| GET/POST | `/api/companies/:id/brokers` | Brokers (`?selectableOnly=1` for pickers) |
| GET/POST | `/api/companies/:id/customers` | Customers |
| GET/POST | `/api/companies/:id/consignees` | Consignees |
| GET/POST | `/api/companies/:id/carriers` | Subcontract carriers |
| GET/POST | `/api/companies/:id/commodities` | Commodities |
| GET/POST | `/api/companies/:id/warehouses` | Warehouses |
| GET | `/api/companies/:id/ports-of-entry` | Border ports |
| GET/POST | `/api/companies/:id/vendors` | Vendors |

### CSV I/O

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/companies/:id/mdm/import/:entity/dry-run` | Validate CSV |
| POST | `/api/companies/:id/mdm/import/:entity` | Commit import |
| GET | `/api/companies/:id/mdm/export/:entity` | Export CSV |

### Fleet consumption

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/loads` | Uses broker, POE, asset status gates |
| PATCH | `/api/loads/:id` | Cross-border validation on update |

### Example: selectable brokers only

```powershell
$r = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" -Body '{"email":"admin@mkx.ca","password":"mkx123"}'
$token = $r.accessToken

Invoke-RestMethod -Uri "http://localhost:3000/api/companies/c1/brokers?selectableOnly=1" `
  -Headers @{ Authorization = "Bearer $token" }
# Inactive / blacklisted brokers omitted
```

---

## 5. Validation matrix (server rules)

| Rule | Enforced by | UI surface |
|------|-------------|------------|
| Inactive / blacklisted not selectable | `canSelectPartyStatus` | Dispatch + invoice pickers |
| OOS asset not assignable | `canAssignAssetStatus` + fleet | Dispatch truck/trailer lists |
| POE sets ACE/ACI/PAPS/PARS | `customsFlagsFromPort` | Dispatch + eManifest |
| Wrong customs program at port | `validateCrossBorderDispatch` | Save blocked |
| Broker id + name snapshot | load + invoice dual-write | Reports / history |
| Merge explicit + audited | company mdm merge | No silent dedupe |
| CSV import permission-gated | company.edit | Import tab |
| Fuel stations: no pricing | schema/UI | Master data copy |

---

## 6. Chapter 5.21 acceptance sign-off

| # | Client requirement | Automated | Manual UAT |
|---|-------------------|-----------|------------|
| 1 | Broker in dispatch **and** accounting | `test:mdm` company § | §3 Phase 2 rows 2.1–2.3 |
| 2 | OOS truck cannot assign + reason | `test:mdm` fleet + Jest | §3 Phase 1 rows 1.2–1.3 |
| 3 | POE populates ACE/ACI/PAPS/PARS | `test:mdm` company § | §3 Phase 5 rows 5.2–5.5 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Master data tab empty | Run `schema-migrate-all`; check tenant DB `company_local` schema |
| Broker not in invoice picker | Apply accounting migration `mdm_phase8_invoice_broker` |
| Port list empty | Tenant border seed SQL (`009+`); reprovision tenant |
| OOS truck still assignable | Asset status exact value; refresh dispatch picker |
| CSV import 403 | User needs `company.edit` |
| Cross-border saves without POE | Ensure `crossBorder: true` on payload |
| Duplicate broker names | Expected — suggest only; use merge API for explicit merge |

---

## 8. What is explicitly out of scope (do not test as bugs)

- Live fuel pricing feeds  
- EDI / QuickBooks / ERP sync  
- Excel import beyond CSV v1  
- AI auto-merge from email  
- Full insurance policy lifecycle  
- New `mdm.*` permission catalog  
- Dedicated mdm-service microservice  

---

## 9. Quick daily smoke (5 minutes)

1. `npm run test:mdm` — all green  
2. Login MKX owner → Company → Master data → Brokers loads  
3. Add test broker → appears in Dispatch broker dropdown  
4. Set a truck OOS → dispatch assignment blocked  
5. Optional: fleet Jest `loads.service.spec`  

---

**End of Chapter 5 Testing Guide**
