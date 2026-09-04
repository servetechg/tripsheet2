# Chapter 6 complete — Driver Management

**Document type:** Architecture Decision Record (close-out)  
**Date:** 2026-08-28  
**Plan:** [DRIVER-CHAPTER-6-PLAN.md](./DRIVER-CHAPTER-6-PLAN.md)  
**Depends on:** Multi-tenant DB-per-company; RBAC Chapter 2; Auth Chapter 4; MDM Chapter 5

Chapter 6 makes the **driver** a first-class operational entity: lifecycle, qualifications, availability, equipment history, payroll alignment, safety/training, and server-side dispatch/customs gates.

---

## Lock-in (unchanged)

| Decision | v1 |
|----------|-----|
| Home | **driver-service** + tenant `driver` schema |
| Lifecycle | `lifecycleStatus` enum; auth sync on suspend/archive |
| Compliance | Server-side `dispatch-ready` + fleet enforcement + audit |
| Equipment | `DriverEquipmentAssignment` with primary auto-close |
| Availability | `availabilityStatus` field + dispatch picker filter |
| Customs | `border-eligible` rules on manifest + cross-border loads |
| Payroll | Contract read-only preview on settlements; auto-pay **deferred** |
| Performance | Computed from fleet loads (no AI score) |

---

## What shipped (Phases 1–9)

| Phase | Outcome |
|-------|---------|
| **1** | Lifecycle enum, approve/suspend/archive, auth sync |
| **2** | `DriverQualification`, dispatch-ready, fleet block + audit |
| **3** | Driver types, employment fields, profile UI |
| **4** | Settlement preview + contract wage line + structured refs |
| **5** | Availability, border-eligible, dispatch/manifest filters |
| **6** | Equipment assignment history + profile + dispatch pre-fill |
| **7** | Safety/training CRUD, performance API, profile tabs |
| **8** | Roster search/filters, driver dashboard alerts, invite revoke/regenerate |
| **9** | In-process + live acceptance suite, this ADR, UAT checklist |

Phase notes: [1–3](./DRIVER-CHAPTER-6-PHASES-1-3-COMPLETE.md) · [4–7](./DRIVER-CHAPTER-6-PHASES-4-7-COMPLETE.md) · [8–9](./DRIVER-CHAPTER-6-PHASES-8-9-COMPLETE.md)

---

## Chapter 6.19 acceptance

| # | Requirement | How we prove it |
|---|-------------|-----------------|
| 1 | HR approve → Active → dispatch available | In-process lifecycle contracts; live: create driver → `dispatch-ready` lifecycleOk; product: approve on pending driver |
| 2 | Expired medical blocks dispatch + logged | Jest + in-process blockers; fleet gate reason string; live: expired medical qual → `dispatch-ready` false |
| 3 | Equipment assignment history | Jest `EquipmentService`; live: assign truck A → B → A closed, B active |

---

## How to verify

In-process (no Docker):

```bash
cd backend
npm run test:drivers
```

Live (gateway + services running):

```bash
cd backend
npm run test:drivers:live
```

Use `DRIVER_OWNER_EMAIL` / `DRIVER_OWNER_PASSWORD` or default MKX admin (`admin@mkx.ca` / `mkx123`).

**Full manual + API testing guide:** [DRIVER-CHAPTER-6-TESTING-GUIDE.md](./DRIVER-CHAPTER-6-TESTING-GUIDE.md)

---

## Manual UAT checklist (client)

### Lifecycle & HR
- [ ] Onboard driver via invite → status **Pending HR Review**
- [ ] HR **Approve** with complete docs → **Active** → appears in dispatch picker
- [ ] **Suspend** driver → cannot log in; removed from default dispatch list
- [ ] **Archive** driver → history retained; not in pickers

### Compliance & dispatch
- [ ] Set medical expiry in past → assign load → blocked with reason
- [ ] Dispatch **Show all drivers** reveals unavailable/vacation drivers
- [ ] Cross-border load / eManifest → ineligible driver blocked on submit

### Equipment
- [ ] Driver profile → Equipment → assign truck A → assign truck B → timeline shows A closed, B active
- [ ] New dispatch pre-fills primary truck/trailer from driver

### Payroll & driver self-service
- [ ] Accounting → new settlement shows contract wage preview + trip sheet lines
- [ ] Driver dashboard shows compliance alerts, payroll summary, availability edit
- [ ] Driver updates availability (vacation) → hidden from default dispatch

### Invites
- [ ] Drivers tab → pending invite → **Revoke** invalidates link
- [ ] **Regenerate** issues new link; old token dead

### Safety & training
- [ ] Add safety event + training record on driver profile
- [ ] Performance tab shows miles / deliveries / on-time %

---

## Explicitly not in Chapter 6 v1

- AI performance score (0–100)
- Full OCR / document versioning workflow
- Auto-pay rate engine from contract
- ELD / HOS / telematics integration
- Team driver pairing model

---

**End of Chapter 6 ADR**
