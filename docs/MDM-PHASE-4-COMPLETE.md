# Phase 4 complete — Catalogs (Commodities + Warehouses)

**Date:** 2026-08-21  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

### Commodity master

| Field | Notes |
|-------|--------|
| name, nmfc, hazmat, tempMin/Max, weightLimit, status | Catalog statuses: active / inactive |
| system seed | General Freight, Auto Parts, Produce, Frozen Food, Dry Goods, Steel, Lumber, Hazmat |

### Warehouse (on Locations)

| Field | Notes |
|-------|--------|
| name, locationId?, hours, docks, appointmentRules, phone, status | Joins Location name/city on list |

### Optional FK + display snapshot

| Surface | Fields |
|---------|--------|
| **Load** | `commodityId` + `commodityName` — Dispatch picker |
| **E-manifest shipment JSON** | `commodityId` + `commodityDesc` snapshot from master (free-text still allowed) |

### APIs

`/api/companies/:id/commodities|warehouses` — GET (`?selectableOnly=1`), POST, PATCH  
RBAC: `company.locations` or `company.edit`

### UI

Company → **Master data** → Commodities / Warehouses tabs.

### Apply

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# ensureMdmCatalogsSchema / schema-migrate-all
# restart company + fleet
```

SQL: `012_mdm_catalogs_phase4.sql`

### Verify

```bash
cd backend && npm run test:rbac
```

## Next

Phase 6 — ops/finance refs. See [MDM-PHASE-5-COMPLETE.md](./MDM-PHASE-5-COMPLETE.md) for Phase 5.
