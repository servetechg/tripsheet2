# Production + Staging deployment (Hostinger KVM 2)

## Environments

| Env | Branch trigger | URL | Strategy |
|-----|----------------|-----|----------|
| **Production** | `main` / `master` | `https://tripsheet.<IP>.sslip.io` | Blue/green |
| **Staging** | `develop` | `https://staging.tripsheet.<IP>.sslip.io` | Single stack |

Use your **real** VPS IPv4 (not the example `203.0.113.10`).

```bash
curl -4 ifconfig.me
dig +short tripsheet.YOUR_REAL_IP.sslip.io
dig +short staging.tripsheet.YOUR_REAL_IP.sslip.io
```

## Architecture

- Shared Postgres + Redis (`compose.infra.yml`)
- Production app: `blue-*` / `green-*` (`compose.app.yml` + `deploy.sh`)
- Staging app: `staging-*` (`compose.staging.yml` + `deploy-staging.sh`)
- Caddy edge for both hostnames (`compose.edge.yml`)
- Images: GitHub Actions → GHCR (or `build-local.sh`)

## First-time / existing VPS — enable staging

```bash
cd /opt/tripsheet/repo
git pull
chmod +x deploy/scripts/*.sh

# Add staging.app.env + STAGING_DOMAIN to edge.env (keeps prod secrets)
./deploy/scripts/init-staging-env.sh

# Create *_staging databases
./deploy/scripts/init-staging-dbs.sh

# Reload Caddy with both hostnames
docker compose -f deploy/compose.edge.yml --env-file /opt/tripsheet/secrets/edge.env up -d

# First staging deploy (use a tag you already built, or build local)
./deploy/scripts/build-local.sh local
# ensure staging.app.env has IMAGE_REGISTRY=tripsheet (or ghcr.io/ORG/REPO)
./deploy/scripts/deploy-staging.sh local
```

Open: `https://staging.tripsheet.YOUR_IP.sslip.io`

Seed staging DBs separately (use `*_staging` database names in DATABASE_URL).

## GitHub Actions

### Environments
Create two GitHub Environments:

- `production` — secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- `staging` — same three secrets (can reuse values)

Optional (recommended for reliable VPS pulls of private packages):

- Repository secret `GHCR_TOKEN` — classic PAT with `read:packages` (+ `write:packages` if needed)
- Repository secret `GHCR_USERNAME` — your GitHub username

Also: **Settings → Actions → General → Workflow permissions → Read and write**.

### Image tags (important)

| Env | Movable tag | Immutable tag |
|-----|-------------|---------------|
| Staging | `staging` | 12-char commit sha |
| Production | `latest` | 12-char commit sha |

Do **not** manually deploy with:

- `local` (only for `build-local.sh` + `IMAGE_REGISTRY=tripsheet`)
- 7-char git short sha (e.g. `5d756a5`) — CI uses **12** chars

After a green staging workflow:

```bash
# on VPS (logged into ghcr.io)
./deploy/scripts/deploy-staging.sh staging
# or the 12-char sha printed in Actions
```

### Workflows
- `.github/workflows/staging.yml` → push to `develop`
- `.github/workflows/production.yml` → push to `main` / `master` only

### Branch flow
1. Feature branch → PR → `develop` → **staging URL**
2. Test on staging
3. PR `develop` → `main` → **production** (blue/green)

### First-time: publish packages then deploy
1. Push these workflow fixes to `develop` (and merge to `main` when ready)
2. GitHub → Actions → **staging** → Run workflow (or push to develop)
3. Wait until build+deploy are green (images appear under Packages)
4. If deploy SSH fails but build succeeded, on VPS:

```bash
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
cd /opt/tripsheet/repo
# ensure IMAGE_REGISTRY=ghcr.io/servetechg/tripsheet2
./deploy/scripts/deploy-staging.sh staging
```

## RAM tip (KVM 2)

Do not run staging + blue + green all day. After a stable prod release, stop the inactive color:

```bash
docker compose -p tripsheet-green -f deploy/compose.app.yml --env-file /opt/tripsheet/secrets/app.env down
# or tripsheet-blue, whichever is inactive
```

Stop staging when idle:

```bash
docker compose -p tripsheet-staging -f deploy/compose.staging.yml --env-file /opt/tripsheet/secrets/staging.app.env down
```

## Backups (Phase 6)

Nightly dump of shared DBs **and** every `fq_tenant_*` database:

```bash
./deploy/scripts/backup.sh
# cron: 15 2 * * * /opt/tripsheet/repo/deploy/scripts/backup.sh >> /opt/tripsheet/backups/cron.log 2>&1
```

Restore one tenant / quarterly drill:

```bash
./deploy/scripts/restore-tenant.sh fq_tenant_SLUG /opt/tripsheet/backups/STAMP/tenants/fq_tenant_SLUG.sql.gz --force
./deploy/scripts/restore-drill.sh
```

Schema migrate-all (also runs automatically after staging/production deploy):

```bash
COMPANY_URL=http://127.0.0.1:3002 ./deploy/scripts/migrate-all-tenants.sh
# or Actions → tenant-migrate workflow
```

Runbooks: `docs/runbooks/suspend-tenant.md`, `restore-tenant.md`, `offboard-tenant.md`.

## Multi-tenant / RBAC / Drivers (Chapter 2–6)

Compose now injects tenant env into gateway, company-service, and tenant-aware microservices (`COMPANY_SERVICE_URL`, `PLATFORM_SECRETS_KEY`, `TENANT_*`).

**After first deploy with tenant env**, on the VPS add to `/opt/tripsheet/secrets/app.env` and `staging.app.env` if missing:

```bash
PLATFORM_SECRETS_KEY=<openssl rand -base64 48 — keep forever once tenants exist>
TENANT_DEFAULT_ROUTING_MODE=shared   # or tenant after cutover
TENANT_RUNTIME_MODE=enforce
```

If tenants were provisioned before `PLATFORM_SECRETS_KEY` existed, company-service used the dev fallback key — set `PLATFORM_SECRETS_KEY=tripsheet-platform-dev-key-change-me` until you re-provision, or generate a new key only on fresh environments.

**Post-deploy tenant ops (Super Admin UI or API):**

1. `POST /api/tenants/c1/provision` — create `fq_tenant_mkx` if pending
2. `POST /api/tenants/schema-migrate-all` — org SQL + service schemas (CI runs this automatically)
3. Optional cutover: `POST /api/tenants/c1/migrate` → `verify` → `cutover` (see MULTI-TENANT testing guide)
4. Suspend/re-enable uses soft revoke + restore (no full re-provision)

**Verify:** login owner → `/api/auth/me` has `permissions[]` and `tenantKey`; driver invite works incognito; `npm run test:tenancy` against staging URL if you expose gateway for ops.

## Rollback (production only)

```bash
./deploy/scripts/rollback.sh
```
