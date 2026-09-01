---
name: tripsheet-verify
description: Verifies TripSheet changes with the smallest correct test command. Maps file paths to npm scripts and avoids full-suite runs. Use when the user asks to test, verify, CI, or "does it work", or after completing a backend/gateway change.
disable-model-invocation: true
---

# TripSheet verify

## Path → command (run ONE)

| Touched paths | Command |
|---------------|---------|
| `backend/gateway/src/rbac/**` | `cd backend && npm run test:rbac` |
| `backend/gateway/src/tenant/**`, `backend/shared/tenant-runtime/**` | `npm run test:tenancy --prefix backend/gateway` |
| `backend/services/auth-service/**`, auth invites/password | `npm run test:auth:live --prefix backend/gateway` |
| `backend/services/company-service/src/mdm/**` | `cd backend && npm run test:mdm` |
| `backend/services/fleet-service/src/loads/**` | `npm test --prefix backend/services/fleet-service -- --testPathPatterns=loads.service.spec` |
| `backend/services/driver-service/**` | `cd backend && npm run test:drivers` |
| `frontend/**` only | No backend test required unless API contract changed; suggest browser smoke |

## Preconditions

- Gateway up for `*:live` scripts: `cd backend && npm run start:dev`
- In-process scripts (`test:rbac`, `test:mdm`, `test:drivers` acceptance) need **no** Docker

## Report format

```
Verify: <command>
Result: pass | fail (first error line)
```

Do not run `test:rbac:all` + `test:drivers:all` + `test:auth:all` unless user asked for full regression.
