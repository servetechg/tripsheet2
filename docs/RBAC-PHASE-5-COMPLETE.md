# Phase 5 complete — Tests + docs

**Date:** 2026-08-19  
**Parent:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)  
**Close-out:** [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md)

## What shipped

Chapter 2 is closed with an **architecture-style persona suite** (same harness pattern as tenancy) plus in-process matrices that do not need running services.

### In-process (CI / every machine)

| Command | Asserts |
|---------|---------|
| `backend/gateway` `npm run test:rbac` | Gateway path+method → permission; owner/accountant/dispatcher/driver allow-deny; 2.10 accountant edit is audited |
| `backend/services/auth-service` `npm run test:auth` | Catalog size, 10 roles, **persona grants** (dispatcher ≠ wage, accountant ≠ dispatch edit, driver ≠ create dispatch, GM ≠ `company.delete`) |
| `backend/services/company-service` `npm run test:rbac` | Custom-role sanitizer (`company.delete` stripped) |

From `backend/`: `npm run test:rbac` runs all three.

### Live suite

`cd backend/gateway && npm run test:rbac:live`

Against a running stack it:

1. Logs in Super Admin (`permissions` must be empty).  
2. Provisions a professional tenant (or `--existing`).  
3. **2.10 #1** — owner staff-invite + create dispatcher; JWT has dispatch, not wage/accounting.  
4. Creates accountant + two drivers.  
5. **2.10 #3** — accountant `GET /loads` 200, `PATCH /loads` **403**, audit contains `rbac.deny`.  
6. **2.10 #2** — driver `GET /loads` only own; other load **403**; JWT includes `driverId`.  
7. Custom role: view-only dispatch; dispatcher loses `dispatch.create` on re-login.  
8. GM / fleet manager grant matrix + fleet vs dispatch gates.  
9. Phase 4: password complexity reject, lockout, login history, logout-all, change-password.  

Cleanup drops the ephemeral tenant unless `--keep`. `--existing` needs `RBAC_OWNER_EMAIL` / `RBAC_OWNER_PASSWORD` or `ADMIN_<slug>_EMAIL` (mkx defaults to `admin@mkx.ca` / `mkx123`).

**Services:** gateway, auth-service, company-service, driver-service, fleet-service.

## How to verify

```bash
cd backend && npm run test:rbac          # in-process only
cd backend && npm run test:rbac:live     # live suite (stack must be up)
cd backend && npm run test:rbac:all      # both
```

## What Phase 5 does *not* do

- Browser UI automation  
- Load/perf tests (see tenancy `test:load`)  
- Implementing deferred MFA/SSO

## Next

Chapter 2 RBAC is **complete**. See [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md) for deferred work (SSO, TOTP, refresh tokens).
