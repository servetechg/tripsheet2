# Phase 3 complete — Subcontract carriers + merge UX (MDM)

**Date:** 2026-08-21  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

### Carrier master ≠ CarrierProfile

| Concept | Where | Purpose |
|---------|--------|---------|
| **`company_local.Carrier`** | MDM Master data | 3rd-party / subcontract carriers (many per company) |
| **`manifest.CarrierProfile`** | E-manifest | Own-company CBSA identity (1:1) — **unchanged** |

Carrier fields: name, MC, DOT, SCAC, phone, email, insuranceExpiry, safetyRating, equipmentNotes, status (same party statuses as brokers).

### Load subcontract link

- `Load.carrierId` + `Load.carrierName` (optional)
- Dispatch create/edit: **Subcontract carrier** picker (`selectableOnly` active/watch)

### Merge UX (explicit, audit-logged)

- `POST /api/companies/:id/mdm/merge`  
  Body: `{ entityType, survivorId, absorbId }`  
  entityType: `Broker` | `Customer` | `Consignee` | `Carrier` | `Location`
- Behavior:
  - Fill blank survivor fields from absorb
  - Reassign fleet/accounting FKs (broker/customer/carrier/location refs)
  - Soft-archive absorb (`inactive` + `archivedAt`)
  - Audit action `mdm.merge`
- UI (Company → Master data):
  - After create with duplicate suggestions: **Keep new · absorb this** / **Keep this · absorb new**
  - List: **Absorb into this…** picker

### Apply

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# schema-migrate-all / ensureMdmCarriersSchema
# restart company + fleet (+ gateway if needed)
```

SQL: `011_mdm_carriers_phase3.sql`

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: create two similar brokers → merge → absorb inactive; create carrier → select on dispatch.

## Next

Phase 5 — Border / POE. See [MDM-PHASE-4-COMPLETE.md](./MDM-PHASE-4-COMPLETE.md) for Phase 4.
