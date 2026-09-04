# E2E Test Results & Planned Fixes

**Date:** 2026-09-03  
**Scope:** Full browser E2E via Playwright against local stack (`frontend :5173`, `gateway :3000`).

Functionality fixes identified below were **reverted** from the codebase. Re-apply them tomorrow using this document. The Playwright suite remains in `frontend/tests/`.

---

## 1. Test execution summary

| Metric | Count |
|--------|------:|
| Total test cases | 41 |
| Passed (with fixes applied) | 40 |
| Skipped | 1 (Accounting tab — hidden for MKX owner entitlements) |
| Failed | 0 |

**Run tests:**
```powershell
cd backend
npm run infra:up
npm run start:dev

# separate terminal
cd frontend
npm run dev

# separate terminal
cd frontend
npx playwright test tests/e2e-full.spec.ts
```

**Watch in browser:** `npx playwright test tests/e2e-full.spec.ts --headed`

---

## 2. Test inventory (what was covered)

### Authentication (11 tests)
- Login page load, empty form validation, invalid credentials
- Super admin / company owner / driver login redirects
- Logout, forgot password, session refresh
- Unauthenticated route guards, role restrictions

### Super Admin (3 tests)
- Companies list, tenant ops tab, create-company validation

### Company Admin (17 tests)
- All 14 sidebar tabs smoke load
- Dispatch: assign load form + empty validation
- Drivers search
- Theme toggle

### Driver Portal (4 tests)
- Sheets, My Docs, Contract, My Load tabs

### Negative / edge (5 tests)
- Invalid invite token, browser back, empty forgot-password, root redirect, unknown route

### Test accounts
| Role | Email | Password |
|------|-------|----------|
| Super admin | admin@tripsheet.io | admin123 |
| MKX owner | admin@mkx.ca | mkx123 |
| MKX driver | divyam@mkx.ca | driver123 |

---

## 3. Bugs found (apply tomorrow)

### BUG-001 — Driver roster empty while driver can log in (P1)

**Symptom:** `admin@mkx.ca` → Drivers tab shows “No drivers yet”, but `divyam@mkx.ca` can log in.

**Root cause:** `AppDataContext.refreshAll()` replaces auth driver users with `driversApi.list()` results; when the API returns empty, roster is wiped.

**Fix — `frontend/src/context/AppDataContext.tsx`**

In the `setUsers` block after `driverUsers` is built (~line 238), merge by email instead of replace:

```typescript
setUsers((prev) => {
  const supers = prev.filter((u) => u.role === 'superadmin');
  const admins = prev.filter(
    (u) => isCompanyOwnerRole(u.role) && u.companyId === companyId,
  );
  const prevDrivers = prev.filter(
    (u) => u.role === 'driver' && u.companyId === companyId,
  );
  const byEmail = new Map<string, AppUser>();
  for (const d of prevDrivers) {
    if (d.email) byEmail.set(d.email.toLowerCase(), d);
  }
  for (const d of driverUsers) {
    if (d.email) byEmail.set(d.email.toLowerCase(), d);
  }
  return [...supers, ...admins, ...Array.from(byEmail.values())];
});
```

**Also — seed driver record in `driver_db`:**

Update `backend/services/driver-service/prisma/seed.ts` and `seed.prod.js` to upsert `divyam@mkx.ca` for company `c1` (use raw SQL if Prisma schema is ahead of DB).

```powershell
cd shared && npm run build
cd backend/services/driver-service
npm run seed
```

**Verify:** Drivers tab shows Divyam; search “divyam” filters correctly.

---

### BUG-002 — Login labels not linked to inputs (P2, a11y)

**Symptom:** `getByLabel('Email')` fails; screen readers don’t associate labels.

**Fix — `frontend/src/components/ui/Inp.tsx` and `FieldInp.tsx`**

- Import `useId` from React
- Generate `inputId = id || useId()`
- Set `<label htmlFor={inputId}>` and `<input id={inputId}>`

After fix, E2E helpers can use `getByLabel('Email', { exact: true })`.

**Verify:** Tab order Email → Password → Continue on login page.

---

### BUG-003 — Browser back after login → `about:blank` (P3)

**Symptom:** Login → dashboard → browser Back → blank page.

**Root cause:** `navigate(..., { replace: true })` after login removes history entry.

**Fix — `frontend/src/routes/AppRoutes.tsx`**

Change LoginRoute `onLogin` handler:

```typescript
// Before
navigate(homePathForRole(u.role), { replace: true });

// After
navigate(homePathForRole(u.role));
```

**Note:** With active session, back to `/login` auto-redirects to dashboard — expected.

---

### BUG-004 — Driver document upload fails (environment + session)

**Symptom:** Red toast: “Driver service is not running or not reachable.”

**Root causes:**
1. **driver-service (port 3003) not running** — often fails compile with `Cannot find module '@tripsheet/shared'`
2. **Port conflicts** — duplicate `start:dev` → `EADDRINUSE` on 3003/3008
3. **Session missing driver record id** — upload sends auth user id instead of driver-service record id

**Environment fix (do first):**
```powershell
cd shared && npm run build
# Kill duplicate node processes on 3003/3008 if EADDRINUSE
cd backend && npm run start:dev
# Confirm: http://localhost:3003/health → {"status":"ok","service":"driver-service"}
```

**Code fix — map `driverId` on login:**

1. `frontend/src/lib/api.ts` — add `driverId?: string | null` to `AuthUserDto`
2. `frontend/src/context/SessionContext.tsx` — in `toAppUser`, set `driverRecordId: u.driverId ?? null`
3. `frontend/src/features/auth/LoginScreen.tsx` — in `finishSession` and MFA `onLogin`, add `driverRecordId: res.user.driverId ?? null`

**Verify:**
1. Login `divyam@mkx.ca` / `driver123`
2. My Docs → UPLOAD on Employment Contract
3. No gateway error; doc status updates after upload

---

## 4. Files to change tomorrow (checklist)

| Priority | File | Change |
|----------|------|--------|
| P1 | `frontend/src/context/AppDataContext.tsx` | Merge driver users by email |
| P1 | `backend/services/driver-service/prisma/seed.*` | Seed divyam driver row |
| P1 | `frontend/src/lib/api.ts` | `driverId` on AuthUserDto |
| P1 | `frontend/src/context/SessionContext.tsx` | Map driverId → driverRecordId |
| P1 | `frontend/src/features/auth/LoginScreen.tsx` | Same mapping on login |
| P2 | `frontend/src/components/ui/Inp.tsx` | htmlFor + id |
| P2 | `frontend/src/components/ui/FieldInp.tsx` | htmlFor + id |
| P3 | `frontend/src/routes/AppRoutes.tsx` | Remove replace on post-login navigate |

---

## 5. Recommended order for tomorrow

1. `cd shared && npm run build`
2. Apply BUG-001 (AppDataContext + driver seed)
3. Apply BUG-004 (driverId session mapping)
4. Restart backend cleanly; verify `:3003/health`
5. Apply BUG-002 and BUG-003
6. Run `npx playwright test tests/e2e-full.spec.ts`
7. Manual: driver doc upload on My Docs

---

## 6. What stays in the repo (not reverted)

| Path | Purpose |
|------|---------|
| `frontend/tests/e2e-full.spec.ts` | 41 E2E test cases |
| `frontend/tests/helpers.ts` | Login/navigation helpers |
| `frontend/playwright.config.ts` | Playwright config |
| `frontend/package.json` | `@playwright/test` dev dependency |

---

## 7. Known limitations / blocked tests

| Item | Reason |
|------|--------|
| Accounting tab | Not in MKX owner sidebar (entitlements) — skipped |
| Staff roles (`/workspace`) | Placeholder UI — not tested |
| MFA flows | Seeded accounts don’t require MFA |
| Full invite → onboard flow | Needs fresh invite token |
| Session idle timeout | Not automated |

---

## 8. Regression risks if fixes not applied

- Dispatch/onboarding blocked when driver roster empty
- Driver uploads fail when service down or wrong driverId
- Accessibility audit failures on forms
- Poor browser-back UX after login
