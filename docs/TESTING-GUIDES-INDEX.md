# Enterprise feature testing guides

Full manual + automated testing guides for each major chapter. Use the same stack bootstrap as any guide: `backend npm run start:dev` + `frontend npm run dev`.

| Guide | Purpose |
|-------|---------|
| **[PRODUCTION-MANUAL-TESTING-GUIDE.md](./PRODUCTION-MANUAL-TESTING-GUIDE.md)** · [PDF](./PRODUCTION-MANUAL-TESTING-GUIDE.pdf) · [DOCX](./PRODUCTION-MANUAL-TESTING-GUIDE.docx) | **Full production UAT** — ~188 test cases covering every feature (start here for client sign-off) |
| [PRD-IMPLEMENTATION-STATUS-REPORT.md](./PRD-IMPLEMENTATION-STATUS-REPORT.md) · [PDF](./PRD-IMPLEMENTATION-STATUS-REPORT.pdf) · [DOCX](./PRD-IMPLEMENTATION-STATUS-REPORT.docx) | PRD vs implementation gap analysis |

| Chapter | Guide | Primary automated command |
|---------|-------|---------------------------|
| **2 — RBAC** | [RBAC-TESTING-GUIDE.md](./RBAC-TESTING-GUIDE.md) | `npm run test:rbac` · `npm run test:rbac:live` |
| **3 — Multi-tenant** | [MULTI-TENANT-TESTING-GUIDE.md](./MULTI-TENANT-TESTING-GUIDE.md) | `npm run test:tenancy` |
| **4 — Auth** | [AUTH-TESTING-GUIDE.md](./AUTH-TESTING-GUIDE.md) | `npm run test:auth:live` · `npm run test:auth:all` |
| **5 — MDM** | [MDM-TESTING-GUIDE.md](./MDM-TESTING-GUIDE.md) | `npm run test:mdm` |
| **6 — Drivers** | [DRIVER-CHAPTER-6-TESTING-GUIDE.md](./DRIVER-CHAPTER-6-TESTING-GUIDE.md) | `npm run test:drivers` · `npm run test:drivers:live` |

**Related:** [TESTING-ENTERPRISE-FEATURES.md](./TESTING-ENTERPRISE-FEATURES.md) — load economics, fleet ops, accounting, analytics (post-Chapter 5/6 product features).

**Client deliverables:** See table above (production UAT guide + PRD status report).

**Cursor agents:** [CURSOR-AGENT-GUIDE.md](./CURSOR-AGENT-GUIDE.md) · [AGENTS.md](../AGENTS.md)

**Seeded accounts (common):**

| Account | Password |
|---------|----------|
| `admin@tripsheet.io` | `admin123` |
| `admin@mkx.ca` | `mkx123` |
| `divyam@mkx.ca` | `driver123` |

**Recommended order for new environments:**

1. Multi-tenant — provision MKX, cutover, `schema-migrate-all`
2. Auth + RBAC — login, users, permissions
3. MDM — master data pickers
4. Drivers — invite → onboard → dispatch gates
