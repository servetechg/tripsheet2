# FleetQuix — Chapter 2 RBAC Plan

**Document type:** Architecture Decision Record (ADR) + Implementation Plan  
**Status:** Complete (Phases 1–5)  
**Version:** 1.4  
**Date:** 2026-08-19  
**Source:** Client Chapter 2 — User Personas & Role-Based Access Control  
**Depends on:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md) (Phases 0–6 complete)

---

## 1. What the client is asking for

Chapter 2 is **not** another tenancy project. Isolation by company is already done. This chapter is **who inside a company may do what**.

| Theme | Client requirement |
|--------|-------------------|
| Personas | Many operational roles (owner, GM, dispatcher, fleet, safety, accountant, HR, driver, …) |
| Permissions | Module catalog (company, users, drivers, dispatch, fleet, accounting, reports, admin) |
| Custom roles | Owner can compose roles from permission categories |
| Least privilege | No permission ⇒ no access |
| Auth | Stronger passwords, MFA, SSO later |
| Sessions | Timeout, devices, forced logout, login history |
| Audit | Immutable log of sensitive actions (login, wage, dispatch delete, role change, …) |
| Rules | Dispatcher ≠ payroll; accountant ≠ dispatch; driver sees self only |

**Acceptance (Chapter 2.10)**

1. Admin with user-management permission creates a dispatcher → invite email + that role’s permissions only.  
2. Driver sees only own dispatches / documents / payroll.  
3. Accountant editing a dispatch is **denied** and the attempt is **audit-logged**.

---

## 2. Current state (baseline)

| Area | Today |
|------|--------|
| Roles | **3 hardcoded:** `superadmin`, `company_admin`, `driver` (`auth_db` enum + `shared/src/roles.ts`) |
| JWT | `sub`, `email`, `role`, `companyId`, `tenantKey` — **no permission list** |
| Gateway | Tenant isolation + plan gates (e.g. accounting). **Not** dispatcher vs accountant |
| UI | Super Admin shell **or** full Company Admin tabs **or** Driver tabs — company staff all share `company_admin` |
| Users | Create user with a Role enum; no invite-for-dispatcher flow |
| Password | DTO min **4** chars; tenant `SecurityPolicy.passwordMinLength` default **8** (not enforced on login create) |
| MFA / SSO / OTP | Flags/docs only — not implemented |
| Sessions | Single JWT, no refresh, no device table, no lockout |
| Audit | `AuditEvent` exists (ip, ua, before/after) — **not** wired to RBAC denials or role changes |

**Conclusion:** Multi-tenant **company** isolation is solid. Chapter 2 **persona RBAC** is not started. `company_admin` is an unbounded in-tenant superuser.

---

## 3. Architecture decisions (lock these)

### 3.1 Keep platform Super Admin out of Chapter 2

Chapter 2 describes **company** roles only. **`superadmin` stays a platform role** (create companies, tenant ops). It is not “Company Owner.”

### 3.2 Map Company Owner to today’s company admin

| Client name | System `roleCode` | Notes |
|-------------|-------------------|--------|
| Company Owner | `company_owner` | Replaces `company_admin` (migration alias: existing `company_admin` → `company_owner`) |
| General Manager | `general_manager` | Cannot delete company |
| Dispatcher | `dispatcher` | |
| Dispatcher Supervisor | `dispatcher_supervisor` | Dispatcher + override/cancel |
| Driver | `driver` | Already exists |
| Fleet Manager | `fleet_manager` | |
| Safety & Compliance | `safety_manager` | |
| Accountant | `accountant` | |
| HR / Driver Manager | `hr_manager` | |
| Maintenance Coordinator | `maintenance_coordinator` | |

**v1 system roles = the 10 in §2.3.** Hierarchy titles **not** in §2.3 are **custom roles later**, not extra enums:

- Operations Manager, Load Coordinator, Payroll Administrator, Shop Technician → **do not seed** until the client specifies a matrix row.

### 3.3 Permissions, not only roles

Hard-coding `if (role === 'dispatcher')` for every API will not scale and blocks custom roles.

**Model**

```text
Permission  (stable codes, e.g. dispatch.create)
    ↑
RolePermission  (system or custom role → many permissions)
    ↑
User.roleCode + companyId   (JWT + auth_db)
```

- **System roles** = seeded templates (same codes in every tenant).  
- **Custom roles** = tenant-owned copies/compositions (Phase 3).  
- **Deny by default** (client rule 9).

v1 catalog = Chapter **2.4 categories** (~50–80 codes), **not** “300+ appendix” (explicitly later).

### 3.4 Where data lives

| Data | Store | Why |
|------|--------|-----|
| User login (email, hash, `roleCode`, `companyId`) | Shared **`auth_db`** | Unchanged from Phase 4 (auth not in tenant DB) |
| Permission catalog | **`auth_db`** (or company-service platform) | Codes are global |
| System role templates | **`auth_db`** | Same defaults for every company |
| Custom roles + overrides | Tenant **`company_local`** | Client: owner composes roles **per company** |
| Login / lockout / sessions | **`auth_db`** | Not operational TMS data |
| RBAC audit | Existing **`AuditEvent`** (tenant or platform by actor) | Enrich; don’t invent a second log |

**Login flow:** auth-service loads `roleCode` → resolves permission set (system template ∪ tenant custom) via company-service → JWT includes `role` + `permissions[]` (or a compact allow-list). Gateway and UI both use that list.

JWT size: keep permission codes short (`disp.create`). If the list grows, switch to JWT `permVer` + gateway cache — **not** in v1 unless needed.

### 3.5 Enforcement layers (all required)

1. **Gateway** — 403 if route module not in JWT permissions (coarse: dispatch / fleet / accounting / admin).  
2. **Service** — fine checks (edit wage, delete dispatch, accountant cannot PATCH loads).  
3. **UI** — hide tabs/actions; **never** the only control.  
4. **Audit** — on deny of sensitive actions + on role/permission changes.

### 3.6 Rejected / deferred (say no unless you reopen)

| Item | Decision |
|------|----------|
| 300+ individual permissions in v1 | **Deferred** (client appendix) |
| Email + OTP, Entra, Google, SAML | **Deferred** (Chapter 2.6 “future” / Enterprise) |
| Full refresh-token + trusted-device SSO-grade session | **Phase 4 partial:** timeout + login history + lockout first |
| Multi-company user (rule 1) | **Deferred** — one `companyId` per user (already true) |
| Shop technician / payroll admin as system roles | **Deferred** — custom role |
| Replacing tenant isolation with RBAC | **No** — RBAC is *inside* a tenant |

---

## 4. v1 permission catalog (from §2.4 + matrix)

Codes are `module.action`. Matrix in §2.5 is the **seed** for system roles.

**Company:** `company.view` `company.edit` `company.locations` `company.billing.view` `company.billing.edit`  
**Users:** `users.create` `users.edit` `users.suspend` `users.delete` `users.reset_password` `users.assign_role`  
**Drivers:** `drivers.create` `drivers.invite` `drivers.edit` `drivers.approve` `drivers.suspend` `drivers.archive` `drivers.docs.view` `drivers.docs.upload` `drivers.docs.delete` `drivers.wage.view` `drivers.wage.edit`  
**Dispatch:** `dispatch.view` `dispatch.create` `dispatch.edit` `dispatch.delete` `dispatch.assign` `dispatch.close` `dispatch.cancel` `dispatch.docs`  
**Fleet:** `fleet.view` `fleet.create` `fleet.edit` `fleet.delete` `fleet.assign` `maintenance.view` `maintenance.schedule`  
**Accounting:** `accounting.view` `settlement.create` `settlement.edit` `payroll.process` `invoice.generate` `accounting.export`  
**Reports:** `reports.view` `reports.export` `reports.schedule`  
**Admin:** `admin.settings` `admin.api_keys` `admin.security` `admin.audit`

**Self-scope:** `driver` and some report/fleet views use **resource scope** (`own` / `assigned`), not extra codes — enforced in services (driver `userId` / assigned load).

**Owner:** all of the above. **GM:** all except `company.delete` (we will add `company.delete` only on owner). **Dispatcher:** dispatch full; drivers yes; fleet/maintenance view; no payroll/wage edit/settings. **Accountant:** accounting full; dispatch **view only**; no dispatch edit. **Fleet manager:** fleet/maintenance full; drivers view; no wage. **Driver:** self only.

Exact seed table will be a JSON/SQL fixture in Phase 1 — not invented ad hoc in each controller.

---

## 5. Auth & session (phased, not all at once)

| Chapter | v1 (implement) | Later |
|---------|----------------|--------|
| Password | Enforce tenant policy (min 12 + complexity **when policy enabled**; don’t break existing `admin123` until a migration/reset window) | History of N passwords |
| Lockout | Count failed logins; lock N minutes | — |
| MFA | Honor `SecurityPolicy.requireMfa` as **block until enrolled** only if we ship TOTP; else keep flag + don’t fake MFA | Entra / Google / SAML |
| Session | JWT expiry from `sessionDays`; optional idle timeout header | Refresh tokens, concurrent device cap, trusted devices |
| Forced logout | `User.tokenVersion` increment | — |

---

## 6. UI / product shape

- **Company shell** is no longer “one admin sees every tab.” Tabs and buttons follow permissions (`dispatch.view` → Dispatch, etc.).  
- **Driver shell** stays `/driver/*` with self-scope.  
- **Super Admin** unchanged (`/admin/*`).  
- **Roles UI** (Company → Users / Roles): assign system role; Phase 3: create custom role from checkboxes.  
- Invite email for **dispatcher** (and other staff) — extend today’s driver-invite or add staff invite; required for 2.10 #1.

---

## 7. Implementation phases

Same cadence as tenancy: lock-in → vertical slices → tests → stop.

### Phase 0 — Design lock-in (this document)

- [x] Client/engineering agree roles list, catalog v1, Super Admin stays platform  
- [x] Agree `company_admin` → `company_owner` migration  
- [x] Out-of-scope list accepted  

### Phase 1 — Catalog + JWT

- [x] Permission + Role + RolePermission tables; seed 10 system roles  
- [x] Migrate `company_admin` → `company_owner`  
- [x] Login `/auth/me` returns `permissions[]`  
- [x] Company Owner still has full in-tenant access (no regression)

See [RBAC-PHASE-1-COMPLETE.md](./RBAC-PHASE-1-COMPLETE.md).

### Phase 2 — Enforce + UI

- [x] Gateway module gates; service checks for matrix rules (accountant ≠ dispatch edit, dispatcher ≠ wage, driver self)  
- [x] UI tab/action hiding  
- [x] Audit **deny** on accountant-edit-dispatch (2.10 #3)  
- [x] Staff invite for dispatcher (2.10 #1)

See [RBAC-PHASE-2-COMPLETE.md](./RBAC-PHASE-2-COMPLETE.md).

### Phase 3 — Custom roles

- [x] Tenant `company_local` custom roles  
- [x] Owner composes from categories  
- [x] Audit `role.changed` / `permission.modified`

See [RBAC-PHASE-3-COMPLETE.md](./RBAC-PHASE-3-COMPLETE.md).

### Phase 4 — Auth hardening

- [x] Policy-backed password rules, lockout, `tokenVersion`, login history  
- [x] MFA: flag only (no TOTP) — documented

See [RBAC-PHASE-4-COMPLETE.md](./RBAC-PHASE-4-COMPLETE.md).

### Phase 5 — Tests + docs

- [x] Architecture-style suite: owner vs dispatcher vs accountant vs driver  
- [x] ADR complete note  

See [RBAC-PHASE-5-COMPLETE.md](./RBAC-PHASE-5-COMPLETE.md) and [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md).  

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| JWT too large | Short codes; cache later |
| Breaking existing company admins | Alias migration; one release with dual accept `company_admin` |
| Weak UI-only RBAC | Gateway + service mandatory in Phase 2 |
| Seed passwords vs 12-char policy | Policy applies to **new** passwords first |

---

## 9. Exit criteria for planning

- [x] ADR written from Chapter 2 vs current 3-role system  
- [x] Lock-in confirmed (role list, `company_owner` rename, defer SSO/300 perms)  
- [x] Phase 1 implemented — see [RBAC-PHASE-1-COMPLETE.md](./RBAC-PHASE-1-COMPLETE.md)
- [x] Phases 2–5 implemented — see [RBAC-CHAPTER-2-COMPLETE.md](./RBAC-CHAPTER-2-COMPLETE.md)
