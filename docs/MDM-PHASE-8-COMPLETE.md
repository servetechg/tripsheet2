# Phase 8 complete — Tests + docs (Chapter 5.21)

**Date:** 2026-08-24  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)  
**Close-out:** [MDM-CHAPTER-5-COMPLETE.md](./MDM-CHAPTER-5-COMPLETE.md)

## What shipped

Chapter 5 is closed with an **architecture acceptance suite** for §5.21 plus the ADR close-out document.

Invoice rows now store optional `brokerId` + `brokerName` so a saved broker is selectable on **dispatch loads** and **AR invoices**. Security UI copy is unchanged (Chapter 4 still owns MFA/SSO claims). Master Data copy states inactive / OOS / blacklisted masters cannot be chosen for new work.

### In-process (always)

| Command | Asserts |
|---------|---------|
| `cd backend && npm run test:rbac` | Includes `check-chapter5-acceptance.ts` in company-service (#1, #3) and fleet-service (#2, #3) |
| `cd backend && npm run test:mdm` | Same 5.21 contracts alone |
| `fleet-service` jest `loads.service.spec` | Live-shaped: create load with OOS truck throws `/Out of Service/` |

### 5.21 mapping

| # | Requirement | How we prove it |
|---|-------------|-----------------|
| 1 | Save broker → available in dispatch **and** accounting | Same `canSelectPartyStatus` filter as `?selectableOnly=1` pickers; active id present on both; inactive hidden; invoice dual-write `brokerId`/`brokerName` |
| 2 | OOS truck cannot be assigned; reason shown | `canAssignAssetStatus('out_of_service') === false`; reason includes unit + “Out of Service”; LoadsService create rejects |
| 3 | POE selection populates ACE/ACI/PAPS/PARS and validates dispatch | Seed port flags + `customsFlagsFromPort` / default program; `validateCrossBorderDispatch` + fleet `validateCrossBorderLoadFields` |

## How to verify

```bash
cd backend && npm run test:rbac
cd backend && npm run test:mdm
cd backend/services/fleet-service && npm test -- --testPathPatterns=loads.service.spec
```

Accounting `Invoice.brokerId` migration: `20260824120000_mdm_phase8_invoice_broker` (`npx prisma migrate deploy` in accounting-service). Restart accounting after generate.

## What Phase 8 does *not* do

- Browser UI automation  
- Excel / EDI / QuickBooks / live fuel pricing  
- Silent auto-merge  
- New `mdm.*` permission codes (still `company.locations` \| `company.edit`)
