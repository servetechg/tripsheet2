# TripSheet — Agent instructions

FleetQuix / TripSheet monorepo. Read this file first; do not re-explore the whole tree unless the task requires it.

## Repo map (where to edit)

| Area | Path | Notes |
|------|------|--------|
| API gateway + RBAC gates | `backend/gateway/` | Port **3000**; proxies to services |
| Microservices | `backend/services/*-service/` | NestJS + Prisma each |
| Shared tenant runtime | `backend/shared/tenant-runtime/` | Tenant DB routing — read before cross-tenant bugs |
| Shared types | `shared/` | Build before backend: `cd shared && npm run build` |
| Frontend | `frontend/` | React + Vite, port **5173** |
| Architecture ADRs | `docs/*-COMPLETE.md`, `docs/*-PLAN.md` | Source of truth per chapter |
| Testing guides | `docs/*-TESTING-GUIDE.md`, `docs/TESTING-GUIDES-INDEX.md` | Use instead of inventing test steps |
| Human Cursor guide | `docs/CURSOR-AGENT-GUIDE.md` | How the team should prompt agents |

## Service ports (local)

| Service | Port |
|---------|------|
| gateway | 3000 |
| auth | 3001 |
| company | 3002 |
| driver | 3003 |
| fleet | 3004 |
| manifest | 3005 |
| tripsheet | 3006 |
| accounting | 3007 |
| notification | 3008 |

## Feature chapters (read ONE relevant doc set)

| Chapter | Complete ADR | Test command |
|---------|--------------|--------------|
| RBAC | `docs/RBAC-CHAPTER-2-COMPLETE.md` | `cd backend && npm run test:rbac` |
| Multi-tenant | `docs/MULTI-TENANT-PHASE-6-COMPLETE.md` | `npm run test:tenancy` |
| Auth | `docs/AUTH-CHAPTER-4-COMPLETE.md` | `npm run test:auth:live` |
| MDM | `docs/MDM-CHAPTER-5-COMPLETE.md` | `npm run test:mdm` |
| Drivers | `docs/DRIVER-CHAPTER-6-COMPLETE.md` | `npm run test:drivers` |

## Default agent workflow (token-efficient)

1. **Clarify scope** in one sentence; if user pointed at a file, read that file first.
2. **Search narrowly** — `Grep` / `Glob` for symbols, not full-tree listing.
3. **Read minimally** — only files on the change path; use `head_limit` / line ranges.
4. **Reuse patterns** — match neighboring modules in the same service.
5. **Smallest correct diff** — one service per task when possible.
6. **Verify with one command** — chapter test script from table above, not full suite unless asked.
7. **Do not** paste large files into chat, re-read `dist/`, or summarize entire docs.

## Multi-tenant reminder

MKX (`c1`) uses **tenant routing** (`fq_tenant_mkx`). Public routes (invite by-token, complete) must resolve tenant DB — see `driver-service` `invites.service.ts` `locateInvite`. Authenticated routes get tenant context from gateway JWT headers.

## Test accounts (seeded)

- Super admin: `admin@tripsheet.io` / `admin123`
- MKX owner: `admin@mkx.ca` / `mkx123`
- MKX driver: `divyam@mkx.ca` / `driver123`

## Commands (common)

```powershell
cd backend && npm run start:dev    # all services
cd frontend && npm run dev
cd backend && npm run infra:up     # postgres + redis
```

Do not commit `.env`, credentials, or `dist/` unless explicitly requested.
