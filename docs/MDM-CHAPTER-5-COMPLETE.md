# Chapter 5 complete — Master Data Management

**Document type:** Architecture Decision Record (close-out)  
**Date:** 2026-08-24  
**Plan:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)  
**Depends on:** Multi-tenant DB-per-company; [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md); [AUTH-CHAPTER-4-COMPLETE.md](./AUTH-CHAPTER-4-COMPLETE.md)

Chapter 5 is **what operational facts a company reuses every day**. Login (Chapter 4) and who may click which button (Chapter 2) were already done. This close-out records what shipped (Phases 1–8) and what remains explicitly out of scope.

---

## Lock-in (unchanged)

| Decision | v1 |
|----------|----|
| Tenancy | Company-scoped masters in the **tenant** DB (`company_local` + existing fleet/accounting schemas) |
| Home | Extend company-service, fleet-service, accounting-service — no separate mdm-service |
| History | Soft archive; historical FKs + name snapshots remain |
| Duplicates | Suggest only; merge is explicit + audited |
| New work | Inactive / OOS / blacklisted / suspended **not selectable** |
| Border seed | Tenant copy of CA–US ports; official codes not company-editable |
| I/O | CSV for brokers, customers, locations, commodities — not Excel/EDI/QB |
| RBAC | Mutating MDM uses existing `company.locations` \| `company.edit` |

---

## What shipped

| Phase | Outcome |
|-------|---------|
| **1** | Asset statuses including **Out of Service**; assignment gate + reason; EquipmentType seed |
| **2** | Location, Broker, Customer, Consignee; dispatch + accounting pickers; duplicate suggestions |
| **3** | Subcontract `Carrier` ≠ own `CarrierProfile`; `Load.carrierId`; explicit `POST …/mdm/merge` |
| **4** | Commodity, Warehouse; load/e-manifest commodity picker |
| **5** | BorderCrossing + PortOfEntry; ACE/ACI/PAPS/PARS populate; cross-border dispatch gate |
| **6** | Vendors, fuel stations (no pricing), insurance on assets, cost centers, payroll cats, ReferenceData |
| **7** | CSV import/export + dry-run error report (permission-gated) |
| **8** | §5.21 architecture suite + this ADR; invoice `brokerId`; Master Data copy matches gates |

Phase notes: [1](./MDM-PHASE-1-COMPLETE.md) · [2](./MDM-PHASE-2-COMPLETE.md) · [3](./MDM-PHASE-3-COMPLETE.md) · [4](./MDM-PHASE-4-COMPLETE.md) · [5](./MDM-PHASE-5-COMPLETE.md) · [6](./MDM-PHASE-6-COMPLETE.md) · [7](./MDM-PHASE-7-COMPLETE.md) · [8](./MDM-PHASE-8-COMPLETE.md)

---

## Chapter 5.21 acceptance

| # | Requirement | How we prove it |
|---|-------------|-----------------|
| 1 | Save broker → available in dispatch **and** accounting | In-process: same selectable filter on both pickers; dual-write `brokerId` + name. Product: dispatch broker select; invoice **Broker (master)** select (`?selectableOnly=1`). |
| 2 | Out of Service truck **cannot** be assigned; reason shown | In-process: `canAssignAssetStatus` + reason string. Jest: `LoadsService.create` rejects OOS with `/Out of Service/`. UI: truck/trailer lists filter `canAssignAsset`. |
| 3 | Selecting a port of entry auto-populates ACE, ACI, PAPS, PARS and validates before dispatch | In-process: seed flags + `customsFlagsFromPort` + company/fleet validators. Product: dispatch/e-manifest `portCustoms` then create/update gate. |

---

## How to verify

In-process (always, no Docker):

```bash
cd backend && npm run test:rbac
cd backend && npm run test:mdm
```

Fleet assignment (Jest, no live stack):

```bash
cd backend/services/fleet-service && npm test -- --testPathPatterns=loads.service.spec
```

Existing tenants: apply accounting migration `20260824120000_mdm_phase8_invoice_broker` (broker on invoices). MDM SQL `009`–`014` remains via `ensureMdm*` / `schema-migrate-all`.

---

## Explicitly not in Chapter 5

- Live fuel pricing  
- EDI / QuickBooks / ERP import  
- Excel polish beyond CSV v1  
- AI auto-merge / auto-create from email  
- Full insurance policy management  
- Replacing Driver/Asset UIs wholesale  
- New `mdm.*` permission catalog or a dedicated mdm-service  
- Reopening multi-tenant DB-per-company or Chapter 2 personas  

Those stay later work or a reopen of this ADR.
