# Phase 5 complete — Border & Ports (acceptance #3)

**Date:** 2026-08-24  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

### Seeded masters (tenant `company_local`)

| Entity | Notes |
|--------|--------|
| **BorderCrossing** | Named CA–US corridors (e.g. Coutts–Sweetgrass) |
| **PortOfEntry** | Official codes from prior FE lists + **ACE / ACI / PAPS / PARS / FAST** flags |

System ports: codes are seeded; companies may change **status** / notes / hours only.

### Dispatch (acceptance #3)

- Load fields: `crossBorder`, `portOfEntryId/Code/Name`, `customsProgram`, `customsAce|Aci|Paps|Pars`
- UI: Cross-border toggle → POE picker → **auto-populates** customs capability pills + ACE/ACI program
- **Gate:** FE + fleet BE reject cross-border create/update without POE + supported program

### E-manifest

- Ports loaded from MDM (`?country=CA|US`) with static fallback
- Selecting POE refreshes PAPS/PARS options from master flags

### APIs

`GET/PATCH …/ports-of-entry`, `GET …/ports-of-entry/:id/customs`, `GET …/border-crossings`  
RBAC: `company.locations` \| `company.edit`

### Apply

```bash
cd backend/services/company-service && node scripts/copy-sql-assets.js
# ensureMdmBorderSchema / schema-migrate-all
# restart company + fleet (+ gateway)
```

SQL: `013_mdm_border_phase5.sql`

### Verify

```bash
cd backend && npm run test:rbac
```

Manual: enable cross-border on dispatch without POE → blocked; pick Sweetgrass → ACE/PAPS shown; Company → Master data → Ports of entry.

## Next

Phase 7 — CSV import/export. See [MDM-PHASE-6-COMPLETE.md](./MDM-PHASE-6-COMPLETE.md) for Phase 6.
