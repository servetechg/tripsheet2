# TripSheet Backend

NestJS microservice foundation for TripSheet.

| Service | Port | Path |
|---------|------|------|
| API Gateway | 3000 | `gateway/` |
| Auth | 3001 | `services/auth-service/` |
| Company | 3002 | `services/company-service/` |
| Driver | 3003 | `services/driver-service/` |
| Fleet | 3004 | `services/fleet-service/` |
| Manifest | 3005 | `services/manifest-service/` |
| TripSheet | 3006 | `services/tripsheet-service/` |
| Accounting | 3007 | `services/accounting-service/` |
| Notification | 3008 | `services/notification-service/` |

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres + Redis)

## 1. Start infrastructure

From `backend/`:

```bash
docker compose up -d
```

This starts:

- **Postgres** on `localhost:5432` with databases: `auth_db`, `company_db`, `driver_db`, `fleet_db`, `manifest_db`, `tripsheet_db`, `accounting_db`, `notification_db`
- **Redis** on `localhost:6379` (used by notification-service SMS rate limiting)

Credentials (default): user `tripsheet` / password `tripsheet`

## 2. Configure environment

Copy root `.env.example` for reference, then copy each service `.env.example` to `.env`:

```bash
# PowerShell
Copy-Item gateway\.env.example gateway\.env
Copy-Item services\auth-service\.env.example services\auth-service\.env
Copy-Item services\company-service\.env.example services\company-service\.env
Copy-Item services\driver-service\.env.example services\driver-service\.env
Copy-Item services\fleet-service\.env.example services\fleet-service\.env
Copy-Item services\manifest-service\.env.example services\manifest-service\.env
Copy-Item services\tripsheet-service\.env.example services\tripsheet-service\.env
Copy-Item services\accounting-service\.env.example services\accounting-service\.env
Copy-Item services\notification-service\.env.example services\notification-service\.env
```

Or from `backend/`: `npm run env:copy`

## 3. Install dependencies

Each service has its own `package.json` (no npm workspaces):

```bash
cd gateway && npm install && cd ..
cd services/auth-service && npm install && cd ../..
cd services/company-service && npm install && cd ../..
cd services/driver-service && npm install && cd ../..
cd services/fleet-service && npm install && cd ../..
cd services/manifest-service && npm install && cd ../..
cd services/tripsheet-service && npm install && cd ../..
cd services/accounting-service && npm install && cd ../..
cd services/notification-service && npm install && cd ../..
```

Or from `backend/`: `npm run install:all`

## 4. Prisma migrate & seed

### New machine (recommended)

From `backend/` — one command after cloning the repo:

```powershell
npm run dev:setup
```

This builds shared packages, copies `.env` files, installs dependencies, starts Postgres/Redis, runs migrations, and seeds **only**:

- Super admin: `admin@tripsheet.io` / `admin123`
- Subscription plans (needed to create companies)

No demo companies, drivers, or tenant databases.

### After `git pull` (schema changed)

```powershell
npm run migrate:all      # apply pending migrations (does not delete data)
npm run migrate:status     # show which services are behind
```

### Clean local dev (fix bad/orphan data)

When dev shows FK errors, half-created drivers, or stale tenant DBs that staging does not have:

```powershell
npm run dev:stop                    # free ports 3000-3008 and 5173 (Windows)
npm run dev:reset -- --yes --stop   # wipe Postgres/Redis volumes, migrate, seed platform
```

Then start again with `npm run start:dev`.

`migrate:all` uses `prisma migrate deploy` — safe for existing databases; it does **not** reset data by itself.

Tenant-specific SQL (per-company DBs) is separate. After services are running:

```bash
# super-admin JWT required in production; locally company-service may expose:
curl -X POST http://localhost:3002/tenants/schema-migrate-all
```

## 5. Start services (dev)

From `backend/` (one terminal — recommended):

```powershell
npm run dev:setup           # first time only (see section 4)
npm run dev:stop            # if EADDRINUSE on 3000-3008
npm run start:dev           # gateway + all services
```

Manual equivalent:

```powershell
npm install
npm run infra:up
npm run env:copy
npm run install:all
npm run migrate:all
npm run seed:platform
npm run start:dev
```

Color-coded logs: `gateway`, `auth`, `company`, `driver`, `fleet`, `manifest`, `tripsheet`.

Start a single service when debugging:

```bash
npm run start:gateway
npm run start:auth
# … start:company | start:driver | start:fleet | start:manifest | start:tripsheet
```

Gateway listens on **http://localhost:3000** with CORS for `http://localhost:5173`.

### Cloudinary (Phase 2)

Document uploads go through **driver-service** → Cloudinary. Set these in `services/driver-service/.env`:

```
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CLOUDINARY_FOLDER=tripsheet/documents
```

Without Cloudinary credentials, the service falls back to storing inline `fileData` (dev only) and logs a warning.

### Tests

```bash
# from backend/
npm test
# or per service:
cd services/driver-service && npm test
cd services/fleet-service && npm test

# Chapter 2 RBAC (in-process, no stack)
npm run test:rbac

# Live persona suite (gateway + auth + company + driver + fleet)
cd gateway && npm run test:rbac:live
```

### Health checks

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Local login (after `dev:setup` / `dev:reset`)

| Email | Password | Role |
|-------|----------|------|
| admin@tripsheet.io | admin123 | superadmin |

Create companies and users from the UI as super admin. Optional E2E fixtures (MKX owner/driver): `npm run seed:e2e` with the stack running.

Login via gateway:

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@tripsheet.io\",\"password\":\"admin123\"}"
```

Or directly against auth-service:

```bash
curl -X POST http://localhost:3001/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@tripsheet.io\",\"password\":\"admin123\"}"
```

## Gateway routes

| Prefix | Upstream |
|--------|----------|
| `/api/auth/*` | auth-service |
| `/api/companies/*` | company-service |
| `/api/drivers/*` | driver-service |
| `/api/loads/*` | fleet-service (loads) |
| `/api/assets/*` | fleet-service (assets) |
| `/api/manifests/*` | manifest-service |
| `/api/trip-sheets/*` | tripsheet-service |

## Stop infrastructure

```bash
docker compose down
```

To also remove DB volumes:

```bash
docker compose down -v
```
