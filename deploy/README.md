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

### Workflows
- `.github/workflows/staging.yml` → push to `develop`
- `.github/workflows/production.yml` → push to `main` / `master` only

### Branch flow
1. Feature branch → PR → `develop` → **staging URL**
2. Test on staging
3. PR `develop` → `main` → **production** (blue/green)

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

## Backups

```bash
./deploy/scripts/backup.sh
# cron: 15 2 * * * /opt/tripsheet/repo/deploy/scripts/backup.sh >> /opt/tripsheet/backups/cron.log 2>&1
```

## Rollback (production only)

```bash
./deploy/scripts/rollback.sh
```
