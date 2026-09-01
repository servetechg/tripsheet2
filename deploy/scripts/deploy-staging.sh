#!/usr/bin/env bash
# Deploy / update the staging stack (single stack, not blue/green).
# Usage: ./deploy/scripts/deploy-staging.sh <IMAGE_TAG>
set -euo pipefail

IMAGE_TAG="${1:?Usage: deploy-staging.sh <IMAGE_TAG>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
APP_ENV="${SECRETS_DIR}/staging.app.env"
EDGE_ENV="${SECRETS_DIR}/edge.env"
PROJECT="tripsheet-staging"

if [[ ! -f "${APP_ENV}" || ! -f "${EDGE_ENV}" ]]; then
  echo "Missing ${APP_ENV} or ${EDGE_ENV}"
  exit 1
fi

# shellcheck disable=SC1090
source "${APP_ENV}"
# shellcheck disable=SC1090
source "${EDGE_ENV}"

export IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY must be set in staging.app.env}"
export POSTGRES_USER POSTGRES_PASSWORD REDIS_PASSWORD
export JWT_SECRET JWT_EXPIRES_IN INTERNAL_API_KEY CORS_ORIGIN
export PLATFORM_SECRETS_KEY TENANT_DEFAULT_ROUTING_MODE TENANT_RUNTIME_MODE TENANT_CACHE_TTL_MS
export CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET CLOUDINARY_FOLDER
export TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER
export DOMAIN STAGING_DOMAIN ACTIVE_COLOR CADDY_ACME_EMAIL

if [[ -z "${STAGING_DOMAIN:-}" ]]; then
  echo "STAGING_DOMAIN must be set in ${EDGE_ENV}"
  exit 1
fi

echo "==> Pulling/starting ${PROJECT} with tag ${IMAGE_TAG}"
echo "    registry: ${IMAGE_REGISTRY}"
if ! docker pull "${IMAGE_REGISTRY}/gateway:${IMAGE_TAG}" >/dev/null 2>&1; then
  echo "ERROR: cannot pull ${IMAGE_REGISTRY}/gateway:${IMAGE_TAG}"
  echo "  - Staging CI publishes tags: <12-char-sha> and 'staging'"
  echo "  - Production CI publishes tags: <12-char-sha> and 'latest'"
  echo "  - Do not use git short sha (7 chars) or 'local' with GHCR"
  echo "  - Run GitHub Actions first, then: docker login ghcr.io"
  echo "  - Example: ./deploy/scripts/deploy-staging.sh staging"
  exit 1
fi

IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
  docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.staging.yml" \
  --env-file "${APP_ENV}" \
  up -d --pull missing

echo "==> Waiting for containers to start"
sleep 8

echo "==> Running Prisma migrations (staging DBs)"
SERVICES=(auth-service company-service driver-service fleet-service manifest-service tripsheet-service accounting-service notification-service)
for svc in "${SERVICES[@]}"; do
  echo "  migrate: ${svc}"
  IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
    docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.staging.yml" --env-file "${APP_ENV}" \
    exec -T "${svc}" npx prisma migrate deploy
done

echo "==> Waiting for staging health endpoints"
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
  host="staging-${entry%%:*}"
  port="${entry##*:}"
  name="${entry%%:*}"
  ok=0
  for _ in $(seq 1 40); do
    if docker exec staging-gateway wget -qO- "http://${host}:${port}/health" >/dev/null 2>&1; then
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

if ! docker exec staging-gateway wget -qO- "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
  echo "  FAIL gateway"
  exit 1
fi
echo "  ok gateway"

echo "==> Reloading Caddy (prod + staging hosts)"
docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d

echo "==> Staging smoke checks"
for _ in $(seq 1 30); do
  if curl -fsS "https://${STAGING_DOMAIN}/healthz" >/dev/null 2>&1 || curl -fsS "http://${STAGING_DOMAIN}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS "https://${STAGING_DOMAIN}/health" >/dev/null 2>&1 \
  || curl -fsS "http://${STAGING_DOMAIN}/health" >/dev/null 2>&1 \
  || echo "WARN: staging /health not reachable yet (DNS/TLS may still be provisioning)"

echo "==> Staging deployed (${IMAGE_TAG})"
echo "    URL: https://${STAGING_DOMAIN}"
