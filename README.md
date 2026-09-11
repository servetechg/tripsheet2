# TripSheet

Professional multi-tenant fleet / trip-sheet platform.

## Layout

```
tripsheet/
├── frontend/     # React + Vite + TypeScript
├── backend/      # NestJS microservices + API gateway
│   ├── gateway/              # :3000
│   └── services/             # auth, company, driver, fleet, manifest, tripsheet, accounting, notification
└── shared/       # Shared TS enums & types
```

## Phase status

| Phase | Status | Scope |
|-------|--------|--------|
| **0 — Foundation** | Done | Monorepo split, TS frontend, Nest scaffold |
| **1 — Core ops** | Done | Live APIs for all current features + FE wiring |
| **2 — Hardening** | Done | Cloudinary uploads, service tests, API-required UI, stricter TS |
| **3 — Ops extensions** | Done | Accounting settlements, SMS notifications (Redis), company reports |

## Phase 3 highlights

- **accounting-service** (`:3007`) — driver settlements (draft → approved → paid) + ops report summary
- **notification-service** (`:3008`) — SMS via Twilio or simulated; Redis rate-limit with in-memory fallback
- Company Admin tabs: **Reports**, **Accounting**
- Invite SMS + load-assign SMS (when driver has a phone)
- Infra: Redis (already in Compose) used by notifications; LB remains a deploy concern

## Quick start

### 1. Shared
```bash
cd shared && npm install && npm run build
```

### 2. Backend (new machine)
```powershell
cd backend
npm run dev:setup
```

This installs deps, starts Postgres/Redis, migrates all service DBs, and seeds super admin + plans only.

Set Cloudinary on `services/driver-service/.env` (optional but recommended):
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=tripsheet/documents
```

Optional Twilio on `services/notification-service/.env` (without it, SMS is simulated and logged):
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
REDIS_URL=redis://localhost:6379
```

After `git pull` when schemas changed: `cd backend && npm run migrate:all`

Clean broken local data: `cd backend && npm run dev:reset -- --yes --stop`

Start all Nest apps:
```bash
cd backend
npm run start:dev
```

Run service tests:
```bash
cd backend
npm test
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — sign-in requires the API gateway (no offline/demo login).

## Local seed users

Created by backend `npm run seed` for empty databases (not shown in the UI):

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@tripsheet.io | admin123 |
| Company Admin | admin@mkx.ca | mkx123 |
| Driver | divyam@mkx.ca | driver123 |
