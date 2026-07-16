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

**Auth service:**

```bash
cd services/auth-service
npx prisma migrate dev --name init
npm run seed
```

**Company service:**

```bash
cd services/company-service
npx prisma migrate dev --name init
npm run seed
```

**Stub services** (optional until you expand models):

```bash
cd services/driver-service && npx prisma migrate dev --name init
cd ../fleet-service && npx prisma migrate dev --name init
cd ../manifest-service && npx prisma migrate dev --name init
cd ../tripsheet-service && npx prisma migrate dev --name init
```

## 5. Start services (dev)

From `backend/` (one terminal — recommended):

```bash
npm install                 # once — installs concurrently
npm run infra:up            # Postgres + Redis
powershell -File scripts/copy-env.ps1   # once — create .env files
npm run install:all         # once — install each Nest app
npm run start:dev           # gateway + all 6 services
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
```

### Health checks

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Demo users (auth-service)

| Email | Password | Role |
|-------|----------|------|
| admin@tripsheet.io | admin123 | superadmin |
| admin@mkx.ca | mkx123 | company_admin (companyId: c1) |
| divyam@mkx.ca | driver123 | driver (companyId: c1) |

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
