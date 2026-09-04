# Phase 2 complete — Locations + party core (MDM)

**Date:** 2026-08-21  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

### Tenant masters (`company_local`)

| Entity | Statuses | Notes |
|--------|----------|-------|
| **Location** | active / inactive | Address backbone; `normalizedKey` for dedupe |
| **Broker** | active / inactive / suspended / blacklisted / watch | MC/DOT/phone; acceptance #1 foundation |
| **Customer** (shipper) | same party statuses | Used by accounting invoices |
| **Consignee** | same party statuses | CRUD ready for manifests later |

Selectable for **new** work: `active` and `watch` only.

### APIs (`/api/companies/:id/…`)

- `locations`, `brokers`, `customers`, `consignees` — GET (optional `?selectableOnly=1`), POST, PATCH  
- Create responses may include `duplicateSuggestions[]` (suggest only — no auto-merge)  
- RBAC: mutating paths use `company.locations` **or** `company.edit`

### Dispatch + accounting wiring

- Load fields: `brokerId`, `brokerName`, `customerId`, `originLocationId`, `destinationLocationId`  
- Invoice field: `customerId` (+ existing `customerName` snapshot)  
- Dispatch UI: broker picker + origin/destination from Location masters  
- Billing UI: customer master picker  

### UI

Company → **Master data** tab: Brokers / Customers / Consignees / Locations CRUD + status.

### Apply

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# schema-migrate-all (or ensureMdmPartiesSchema on next org load)
# restart company, fleet, accounting, gateway
```

SQL: `010_mdm_parties_phase2.sql`

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: create broker → appears on dispatch; set broker blacklisted → gone from selectable list; create similar name → duplicate suggestion.

## Next

Phase 4 — Commodities / Warehouses. See [MDM-PHASE-3-COMPLETE.md](./MDM-PHASE-3-COMPLETE.md) for Phase 3.
