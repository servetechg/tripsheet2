# TripSheet

Professional multi-tenant fleet / trip-sheet platform.

## Layout

```
tripsheet/
├── frontend/     # React + Vite + TypeScript
├── backend/      # NestJS microservices + API gateway
│   ├── gateway/              # :3000
│   └── services/             # auth, company, driver, fleet, manifest, tripsheet
└── shared/       # Shared TS enums & types
```

## Phase status

| Phase | Status | Scope |
|-------|--------|--------|
| **0 — Foundation** | Done | Monorepo split, TS frontend, Nest scaffold |
| **1 — Core ops** | Done | Live APIs for all current features + FE wiring |
| **2 — Hardening** | Done | Cloudinary uploads, service tests, API-required UI, stricter TS |
| 3 — Later | Pending | Accounting, SMS, reports |

## Phase 2 highlights

- **Cloudinary** for driver documents (`fileUrl` + `cloudinaryPublicId`; no huge base64 in DB when configured)
- **Jest tests** for load assign/status rules and dispatch-ready doc gate
- **Live API required** — offline seed login removed; login shows reconnect UI if gateway is down
- Frontend `strict` + `strictNullChecks` enabled (`noImplicitAny` still gradual)

## Quick start

### 1. Shared
```bash
cd shared && npm install && npm run build
```

### 2. Backend
```bash
cd backend
npm install
npm run infra:up
npm run env:copy
npm run install:all
```

Set Cloudinary on `services/driver-service/.env`:
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=tripsheet/documents
```

Migrate + seed (first time / after schema changes):
```bash
cd services/auth-service && npx prisma migrate dev && npm run seed && cd ../..
cd services/company-service && npx prisma migrate dev && npm run seed && cd ../..
cd services/driver-service && npx prisma migrate dev && npm run seed && cd ../..
cd services/fleet-service && npx prisma migrate dev && npm run seed && cd ../..
cd services/manifest-service && npx prisma migrate dev && npm run seed && cd ../..
cd services/tripsheet-service && npx prisma migrate dev && cd ../..
```

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

Open http://localhost:5173 — sign-in requires **● Live API**.

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@tripsheet.io | admin123 |
| Company Admin | admin@mkx.ca | mkx123 |
| Driver | divyam@mkx.ca | driver123 |
