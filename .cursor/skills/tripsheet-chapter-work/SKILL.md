---
name: tripsheet-chapter-work
description: Implements or fixes TripSheet enterprise chapters (RBAC, multi-tenant, auth, MDM, drivers). Reads the matching COMPLETE ADR and TESTING-GUIDE only, edits minimal files, runs the chapter npm test. Use when the user mentions Chapter 2/3/4/5/6, auth, RBAC, tenant, MDM, master data, drivers, invites, or gateway permissions.
disable-model-invocation: true
---

# TripSheet chapter work

## Pick the chapter (read ONE pair of docs)

| User says | Read | Test |
|-----------|------|------|
| RBAC, permissions, personas | `docs/RBAC-CHAPTER-2-COMPLETE.md` | `cd backend && npm run test:rbac` |
| Multi-tenant, provision, isolation | `docs/MULTI-TENANT-PHASE-6-COMPLETE.md` | `npm run test:tenancy --prefix backend/gateway` |
| Auth, login, MFA, password, sessions | `docs/AUTH-CHAPTER-4-COMPLETE.md` | `npm run test:auth:live --prefix backend/gateway` |
| MDM, brokers, ports, master data | `docs/MDM-CHAPTER-5-COMPLETE.md` | `cd backend && npm run test:mdm` |
| Drivers, qualifications, equipment | `docs/DRIVER-CHAPTER-6-COMPLETE.md` | `cd backend && npm run test:drivers` |

Manual steps: same-name `docs/*-TESTING-GUIDE.md` — use for UAT only, not full read unless debugging.

## Implementation order

1. Grep for existing pattern in the **same service** (e.g. `invites.service.ts` before new invite logic).
2. Change gateway + one service max unless cross-cutting tenant bug.
3. Run chapter test command once.
4. Report: files changed, test result, one manual check if UI-facing.

## Tenant pitfalls

- MKX uses `routingMode=tenant` → data in `fq_tenant_mkx`, not shared `*_db`.
- Public invite/reset routes have **no JWT** → must resolve tenant or use shared index.

## Do not

- Re-read all phase COMPLETE files (`AUTH-PHASE-1` … `AUTH-PHASE-7`)
- Provision new tenants unless test requires it
- Create new ADR/testing guide unless user asked
