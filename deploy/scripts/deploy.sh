#!/usr/bin/env bash
# Deploy (or switch) a blue/green color.
# Usage:
#   ./deploy/scripts/deploy.sh blue local     # first deploy with locally built images
#   ./deploy/scripts/deploy.sh green abc1234  # CI tag from GHCR
set -euo pipefail

DEPLOY_COLOR="${1:?Usage: deploy.sh <blue|green> <IMAGE_TAG>}"
CLI_IMAGE_TAG="${2:?Usage: deploy.sh <blue|green> <IMAGE_TAG>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
APP_ENV="${SECRETS_DIR}/app.env"
EDGE_ENV="${SECRETS_DIR}/edge.env"

if [[ "${DEPLOY_COLOR}" != "blue" && "${DEPLOY_COLOR}" != "green" ]]; then
  echo "COLOR must be blue or green"
  exit 1
fi

PROJECT="tripsheet-${DEPLOY_COLOR}"

if [[ ! -f "${APP_ENV}" || ! -f "${EDGE_ENV}" ]]; then
  echo "Missing ${APP_ENV} or ${EDGE_ENV}"
  exit 1
fi

# shellcheck disable=SC1090
source "${APP_ENV}"
# shellcheck disable=SC1090
source "${EDGE_ENV}"

# CLI color wins over legacy COLOR= in app.env (CI passes blue/green explicitly).
COLOR="${DEPLOY_COLOR}"
IMAGE_TAG="${CLI_IMAGE_TAG}"
export COLOR IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY must be set in app.env}"
export POSTGRES_USER POSTGRES_PASSWORD REDIS_PASSWORD
export JWT_SECRET JWT_EXPIRES_IN INTERNAL_API_KEY CORS_ORIGIN
export PLATFORM_SECRETS_KEY TENANT_DEFAULT_ROUTING_MODE TENANT_RUNTIME_MODE TENANT_CACHE_TTL_MS
export CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET CLOUDINARY_FOLDER
export TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER
export DOMAIN STAGING_DOMAIN ACTIVE_COLOR CADDY_ACME_EMAIL

echo "==> Pulling/starting ${PROJECT} with tag ${IMAGE_TAG}"
echo "    registry: ${IMAGE_REGISTRY}"
if ! docker pull "${IMAGE_REGISTRY}/gateway:${IMAGE_TAG}" >/dev/null 2>&1; then
  echo "ERROR: cannot pull ${IMAGE_REGISTRY}/gateway:${IMAGE_TAG}"
  echo "  - Production CI publishes tags: <12-char-sha> and 'latest'"
  echo "  - Do not use git short sha (7 chars) or 'local' with GHCR"
  echo "  - Run GitHub Actions (production) first, then: docker login ghcr.io"
  echo "  - Example: ./deploy/scripts/deploy.sh green latest"
  exit 1
fi

echo "==> Pulling images for ${PROJECT} (tag ${IMAGE_TAG})"
COLOR="${COLOR}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
  docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.app.yml" \
  --env-file "${APP_ENV}" \
  pull

echo "==> Running Prisma migrations (one-off containers, before app start)"
COLOR="${COLOR}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
  "${ROOT_DIR}/deploy/scripts/run-prisma-migrations.sh" \
  "${PROJECT}" "${DEPLOY_DIR}/compose.app.yml" "${APP_ENV}"

COLOR="${COLOR}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
  docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.app.yml" \
  --env-file "${APP_ENV}" \
  up -d --force-recreate --remove-orphans

echo "==> Waiting for containers to start"
sleep 8

echo "==> Waiting for health endpoints"
PORTS=(
  "auth-service:3001"
  "company-service:3002"
  "driver-service:3003"
  "fleet-service:3004"
  "manifest-service:3005"
  "tripsheet-service:3006"
  "accounting-service:3007"
  "notification-service:3008"
)
for entry in "${PORTS[@]}"; do
  host="${COLOR}-${entry%%:*}"
  port="${entry##*:}"
  name="${entry%%:*}"
  ok=0
  for _ in $(seq 1 40); do
    if docker exec "${COLOR}-gateway" wget -qO- "http://${host}:${port}/health" >/dev/null 2>&1; then
      echo "  ok ${name}"
      ok=1
      break
    fi
    sleep 3
  done
  if [[ "${ok}" -ne 1 ]]; then
    echo "  FAIL ${name}"
    exit 1
  fi
done

if ! docker exec "${COLOR}-gateway" wget -qO- "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
  echo "  FAIL gateway"
  exit 1
fi
echo "  ok gateway"

if ! docker exec "${COLOR}-gateway" wget -qO- "http://${COLOR}-frontend:80/healthz" >/dev/null 2>&1; then
  echo "  FAIL frontend"
  docker logs "${COLOR}-frontend" --tail 40 2>&1 || true
  exit 1
fi
echo "  ok frontend"

echo "==> Switching edge traffic to ${COLOR}"
# Update edge.env ACTIVE_COLOR and recreate caddy
tmp="$(mktemp)"
awk -v c="${COLOR}" '
  BEGIN{updated=0}
  /^ACTIVE_COLOR=/ { print "ACTIVE_COLOR=" c; updated=1; next }
  { print }
  END { if (!updated) print "ACTIVE_COLOR=" c }
' "${EDGE_ENV}" > "${tmp}"
mv "${tmp}" "${EDGE_ENV}"
echo "ACTIVE_COLOR=${COLOR}" > "${DEPLOY_DIR}/caddy/active.env"

# Caddy resolves {$ACTIVE_COLOR} at container start — must recreate after color switch.
docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d --force-recreate caddy

echo "==> Edge routing"
echo "    ACTIVE_COLOR=${COLOR}"
docker inspect "${COLOR}-frontend" --format '    frontend image: {{.Config.Image}}' 2>/dev/null || true

echo "==> Public smoke checks"
for _ in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/healthz" >/dev/null 2>&1 || curl -fsS "http://${DOMAIN}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

html=""
for _ in $(seq 1 15); do
  html="$(curl -fsS "https://${DOMAIN}/login" 2>/dev/null || curl -fsS "http://${DOMAIN}/login" 2>/dev/null || true)"
  if [[ -n "${html}" ]]; then
    break
  fi
  sleep 2
done
if [[ -z "${html}" ]]; then
  echo "ERROR: ${DOMAIN}/login not reachable (502?) — try: ./deploy/scripts/repair-production-edge.sh ${COLOR}"
  exit 1
fi
if grep -q 'Welcome back' <<<"${html}"; then
  echo "WARN: old login UI detected — recreate caddy and verify ${COLOR}-frontend image"
  docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d --force-recreate caddy
fi

curl -fsS "https://${DOMAIN}/health" >/dev/null 2>&1 \
  || curl -fsS "http://${DOMAIN}/health" >/dev/null 2>&1 \
  || echo "WARN: public /health not reachable yet (DNS/TLS may still be provisioning)"

echo "==> Deployed ${COLOR} (${IMAGE_TAG}) as active"
echo "    Keep the other color running briefly for rollback: ./deploy/scripts/rollback.sh"
