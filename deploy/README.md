# Production deployment (Hostinger KVM 2)

## Architecture

- Docker Compose: shared Postgres + Redis
- Blue/green app stacks (`blue-*` / `green-*` containers)
- Caddy on ports 80/443 with automatic HTTPS
- Temporary domain: `tripsheet.<YOUR_REAL_VPS_IP>.sslip.io`
- Images built in GitHub Actions → GHCR (or `build-local.sh` for first bring-up)

## Important

`203.0.113.10` in earlier docs is an **example IP**. Use your real VPS IPv4:

```bash
curl -4 ifconfig.me
dig +short tripsheet.YOUR_REAL_IP.sslip.io
```

## On the VPS (after Docker + deploy user are ready)

```bash
# 1) Clone repo
sudo mkdir -p /opt/tripsheet
sudo chown -R deploy:deploy /opt/tripsheet
cd /opt/tripsheet
git clone YOUR_REPO_URL repo
cd repo

# 2) Create secrets (never commit these)
mkdir -p /opt/tripsheet/secrets
chmod 700 /opt/tripsheet/secrets
cp deploy/secrets.example.env /opt/tripsheet/secrets/README.txt

# Create three files from the example sections:
#   /opt/tripsheet/secrets/infra.env
#   /opt/tripsheet/secrets/app.env
#   /opt/tripsheet/secrets/edge.env

openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # REDIS_PASSWORD
openssl rand -base64 48 # JWT_SECRET
openssl rand -hex 32   # INTERNAL_API_KEY

# In edge.env / app.env set:
#   DOMAIN=tripsheet.YOUR_REAL_IP.sslip.io
#   CORS_ORIGIN=https://tripsheet.YOUR_REAL_IP.sslip.io
#   IMAGE_REGISTRY=tripsheet   # local first deploy
#   CADDY_ACME_EMAIL=you@example.com

chmod 600 /opt/tripsheet/secrets/*.env

# 3) Bootstrap infra
chmod +x deploy/scripts/*.sh
./deploy/scripts/bootstrap.sh

# 4) First deploy (build on VPS — slower; OK once)
./deploy/scripts/build-local.sh local
# ensure app.env has IMAGE_REGISTRY=tripsheet
./deploy/scripts/deploy.sh blue local

# 5) Open the site
# https://tripsheet.YOUR_REAL_IP.sslip.io
```

## Blue/green release

```bash
./deploy/scripts/deploy.sh green local   # or a GHCR tag
./deploy/scripts/rollback.sh             # switch back if needed
```

## GitHub Actions secrets

- `VPS_HOST` — VPS IP
- `VPS_USER` — `deploy`
- `VPS_SSH_KEY` — private key for deploy user
- Create GitHub Environment named `production`

Never put Hostinger panel passwords in GitHub or `.env`.

## Backups

```bash
./deploy/scripts/backup.sh
# cron example (daily 02:15 UTC):
# 15 2 * * * /opt/tripsheet/repo/deploy/scripts/backup.sh >> /opt/tripsheet/backups/cron.log 2>&1
```
