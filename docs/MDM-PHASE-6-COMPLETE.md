# Phase 6 complete — Ops / finance reference (thin)

**Date:** 2026-08-24  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

Company-scoped catalogs for day-to-day ops. **No live fuel pricing.** Inactive rows are not selectable.

| Master | Seed / notes |
|--------|----------------|
| **MaintenanceVendor** | CRUD; optional on maintenance records (`vendorId` + name snapshot) |
| **FuelStation** | Name + brand + optional location — directory only |
| **InsuranceProvider** | Optional on assets (`insuranceProviderId` + name snapshot) |
| **CostCenter** | Seeded OPS / FLEET / ADMIN |
| **PayrollCategory** | Seeded Mileage / Hourly / Detention / Layover |
| **ReferenceData** | Seeded `expense_category` set used by trip-sheet expenses |

### Wiring

- **Fleet ops:** vendor picker on maintenance create  
- **Assets:** insurance provider picker + expiry  
- **Trip sheets:** expense categories from `ReferenceData` (fallback hardcoded list)

### APIs

`/maintenance-vendors`, `/fuel-stations`, `/insurance-providers`, `/cost-centers`, `/payroll-categories`, `/reference-data`  
RBAC: `company.locations` \| `company.edit`

### Apply

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# ensureMdmOpsSchema / schema-migrate-all
# restart company + fleet
```

SQL: `014_mdm_ops_phase6.sql`

### Verify

```bash
cd backend && npm run test:rbac
```

## Next

Phase 7 — CSV import/export. See [MDM-PHASE-7-COMPLETE.md](./MDM-PHASE-7-COMPLETE.md).
