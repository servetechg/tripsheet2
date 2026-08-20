# Chapter 2 complete — User personas & RBAC

**Document type:** Architecture Decision Record (close-out)  
**Date:** 2026-08-19  
**Plan:** [RBAC-CHAPTER-2-PLAN.md](./RBAC-CHAPTER-2-PLAN.md)  
**Depends on:** Multi-tenant DB-per-company (Phases 0–6 complete)

Chapter 2 is **who inside a company may do what**. Company isolation was already done. This close-out records what shipped (Phases 1–5) and what remains explicitly out of scope.

---

## Lock-in (unchanged)

| Decision | v1 |
|----------|----|
| Super Admin | Platform-only. JWT `permissions: []`. Not a company persona. |
| Company Owner | `company_owner` (API still accepts `company_admin`) |
| System roles | 10 templates in `auth_db` — not extra enum values for custom jobs |
| Permissions | ~55 `module.action` codes on the JWT; deny by default |
| Users | Stay on shared `auth_db` |
| Custom roles | Tenant `company_local` only |
| MFA / SSO | Flag only (no TOTP / Entra / SAML in this chapter) |

---

## What shipped

| Phase | Outcome |
|-------|---------|
| **1** | Catalog + JWT `permissions[]`. Owner full in-tenant access. |
| **2** | Gateway + service enforcement + UI. Staff invite. Accountant dispatch edit → 403 + `rbac.deny`. Driver self-scope. |
| **3** | Owner composes tenant custom roles; login loads those grants. |
| **4** | Tenant password policy (new passwords), lockout, `tokenVersion`, login history. MFA checkbox does not block login. |
| **5** | Persona matrix tests (in-process + live architecture suite). This document. |

Phase notes: [1](./RBAC-PHASE-1-COMPLETE.md) · [2](./RBAC-PHASE-2-COMPLETE.md) · [3](./RBAC-PHASE-3-COMPLETE.md) · [4](./RBAC-PHASE-4-COMPLETE.md) · [5](./RBAC-PHASE-5-COMPLETE.md)

---

## Chapter 2.10 acceptance

| # | Requirement | How we prove it |
|---|-------------|-----------------|
| 1 | Admin with user-management creates a dispatcher → that role’s permissions only | Owner `POST /api/auth/users` + staff invite; dispatcher JWT has `dispatch.create`, not wage/payroll. Live suite §4. |
| 2 | Driver sees only own dispatches / documents / payroll | Fleet list/get scoped by JWT `driverId`. Live suite §7. |
| 3 | Accountant editing a dispatch is denied and audit-logged | Gateway 403 on `PATCH /api/loads`; `AuditEvent.action = rbac.deny`. Live suite §6. |

---

## How to verify (no live stack vs live)

In-process (always, no Docker):

```bash
cd backend && npm run test:rbac
```

Runs gateway route gates, auth catalog + persona grants, company-service custom-role sanitizer.

Live (gateway + auth + company + driver + fleet):

```bash
cd backend
npm run test:rbac:live          # provisions an ephemeral company, then deprovisions
npm run test:rbac:all           # in-process + live
# or from gateway:
npm run test:rbac:live:keep     # leave the company
npm run test:rbac:live:existing # one existing tenant (RBAC_OWNER_* or mkx admin)
```

---

## Explicitly not in Chapter 2

- 300+ appendix permissions  
- Email OTP, Entra, Google, SAML  
- Real TOTP MFA (flag is stored only)  
- Refresh tokens, device cap, password-history of N hashes  
- Multi-company users  
- Shop technician / payroll admin as **system** roles (use custom roles)

Those stay later chapters or a reopen of this ADR.
