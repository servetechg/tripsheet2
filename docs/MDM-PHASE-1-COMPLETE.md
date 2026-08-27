# Phase 1 complete — Fleet & driver alignment (MDM)

**Date:** 2026-08-21  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

### Asset status (client §5.7 / §5.8)

| Status | Assignable? |
|--------|-------------|
| `available` | Yes |
| `assigned` | Yes (already on a load; reassignment rules elsewhere) |
| `maintenance` | **No** |
| `out_of_service` | **No** — acceptance #2 |
| `retired` | **No** |

Legacy `active` → `available`, `inactive` → `retired` (normalized on write + tenant SQL migrate).

### Assignment gates

- Creating/updating a load with `truckId` / `trailerId` **blocks** non-assignable assets with a clear reason (e.g. `Unit T-101 is Out of Service and cannot be assigned`).
- Inactive drivers (`Driver.active === false`) blocked via driver-service lookup.
- Denials audited as `mdm.assignment_denied` on company `AuditEvent`.

### EquipmentType catalog (§5.11)

- Tenant table `fleet.EquipmentType` seeded with Dry Van, Reefer, Flatbed, Step Deck, Double Drop, RGN, Power Only, Container, Tanker, Hopper, Car Hauler.
- `GET /assets/equipment-types?companyId=`
- Optional `Asset.equipmentTypeCode`

### UI

- Assets: status dropdown (all five statuses) + Retire / Make available.
- Dispatch: truck/trailer pickers only show assignable units; inactive drivers not selectable.

### Apply to existing tenants

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# Super Admin → schema-migrate-all, or open any company path that calls ensureMdmFleetSchema
# Or: POST tenant schema migrate for each company
```

Restart **fleet** and **company** services after build.

### Verify

```bash
cd backend && npm run test:rbac          # includes fleet check-asset-status
cd backend/services/fleet-service && npm test
```

Manual: mark a truck Out of Service → dispatch assignment fails with reason; inactive driver cannot be picked.

## Phase 0 lock-ins recorded

- Fleet/equipment MDM lives in **fleet-service** + tenant `fleet` schema (not a new mdm-service for Phase 1).
- Border/POE seed strategy remains for Phase 5.

## Next

Phase 3 — subcontract Carrier master + merge UX. See [MDM-PHASE-2-COMPLETE.md](./MDM-PHASE-2-COMPLETE.md) for Phase 2.
