# Phase 7 complete — MDM CSV import / export

**Date:** 2026-08-24  
**Parent:** [MDM-CHAPTER-5-PLAN.md](./MDM-CHAPTER-5-PLAN.md)

## What shipped

CSV **export** and **import** for the four priority masters (Chapter 5.19 v1):

| Entity | Columns |
|--------|---------|
| Brokers | name, mc, dot, scac, phone, email, website, paymentTerms, rateConfEmail, status, notes |
| Customers | name, legalName, dba, phone, email, website, paymentTerms, creditLimit, currency, taxExempt, status, notes |
| Locations | name, line1, line2, city, region, postal, country, timeZone, status |
| Commodities | name, nmfc, hazmat, tempMin, tempMax, weightLimit, status, notes |

- RFC4180-style CSV in JSON (`{ csv }`) so the existing gateway JSON proxy can carry it — no multipart / extra parser dependency.
- **Dry-run** is the default: validates rows, reports errors, counts would-create vs skip. `dryRun: false` commits.
- Exact `normalizedKey` matches (tenant or same file) are **skipped**, not merged. Invalid rows stay in the error report and are not written.
- Cap: 2,000 data rows per request.
- Committed imports write `mdm.import` to company audit.

### APIs

- `GET /api/companies/:id/mdm/export?entity=brokers|customers|locations|commodities` → `{ entity, filename, csv }`
- `POST /api/companies/:id/mdm/import` `{ entity, csv, dryRun }` → `{ dryRun, created, wouldCreate, skipped, errorCount, errors[{row,field,message}], preview }`

**RBAC:** both routes require `company.locations` **or** `company.edit` (evaluated **before** the generic `GET /api/companies → any` rule). Company owners still bypass.

### UI

Master Data → **Import / export**: choose entity, export current catalog, paste or upload CSV, **Dry-run**, then **Import**. Brokers / customers / locations / commodities tabs also have **Export CSV**.

### Verify

```bash
cd backend && npm run test:rbac
```

Includes `company-service` `src/mdm/check-csv.ts` (parse/serialize + row validation).

## What Phase 7 does *not* do

- Excel, EDI, QuickBooks, or ERP feeds (deferred)
- Silent merge of near-duplicates (still suggest / explicit merge from Phase 3)
- Carriers, consignees, ports, or ops catalogs in this CSV wave
- Schema migrations (reuses existing masters)

## Next

Phase 8 — architecture suite + chapter close-out. See [MDM-PHASE-8-COMPLETE.md](./MDM-PHASE-8-COMPLETE.md).
