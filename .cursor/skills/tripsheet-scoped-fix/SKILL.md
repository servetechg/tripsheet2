---
name: tripsheet-scoped-fix
description: Fixes a single bug with minimal exploration in TripSheet. User provides file, error, or screenshot; agent greps symbol, reads 1-3 files, patches, runs one verify command. Use for "fix this error", "why does X fail", incognito invite, 403, tenant not found.
disable-model-invocation: true
---

# Scoped fix workflow

## Steps (strict)

1. **Anchor** — user’s file path, error message, or API status code.
2. **Grep** — exact symbol or string from error (one `Grep`, not Task explore).
3. **Read** — max 3 files: failing site, caller, one reference implementation.
4. **Patch** — smallest diff; no drive-by refactors.
5. **Verify** — invoke `tripsheet-verify` skill logic (one npm command).

## Common anchors

| Symptom | First file to read |
|---------|-------------------|
| Invite invalid incognito | `backend/services/driver-service/src/invites/invites.service.ts` |
| 403 on API | `backend/gateway/src/rbac/route-permissions.ts` |
| Wrong tenant data | `backend/shared/tenant-runtime/src/prisma-proxy.ts` |
| UI wrong link | `frontend/src/features/<tab>/` + `frontend/src/lib/api.ts` |

## Stop conditions

- If fix needs >5 files, summarize plan in 3 bullets and ask before continuing.
- If root cause is "services not running", say so — don’t patch code.
