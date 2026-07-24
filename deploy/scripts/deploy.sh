#!/usr/bin/env bash
# Deploy (or switch) a blue/green color.
# Usage:
#   ./deploy/scripts/deploy.sh blue local     # first deploy with locally built images
#   ./deploy/scripts/deploy.sh green abc1234  # CI tag from GHCR
set -euo pipefail

COLOR="${1:?Usage: deploy.sh <blue|green> <IMAGE_TAG>}"
IMAGE_TAG="${2:?Usage: deploy.sh <blue|green> <IMAGE_TAG>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
APP_ENV="${SECRETS_DIR}/app.env"
EDGE_ENV="${SECRETS_DIR}/edge.env"
PROJECT="tripsheet-${COLOR}"

if [[ "${COLOR}" != "blue" && "${COLOR}" != "green" ]]; then
  echo "COLOR must be blue or green"
  exit 1
fi

if [[ ! -f "${APP_ENV}" || ! -f "${EDGE_ENV}" ]]; then
  echo "Missing ${APP_ENV} or ${EDGE_ENV}"
  exit 1
fi

# shellcheck disable=SC1090
source "${APP_ENV}"
# shellcheck disable=SC1090
source "${EDGE_ENV}"

export COLOR IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY must be set in app.env}"
export POSTGRES_USER POSTGRES_PASSWORD REDIS_PASSWORD
export JWT_SECRET JWT_EXPIRES_IN INTERNAL_API_KEY CORS_ORIGIN
export CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET CLOUDINARY_FOLDER
export TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER
export DOMAIN ACTIVE_COLOR CADDY_ACME_EMAIL

echo "==> Pulling/starting ${PROJECT} with tag ${IMAGE_TAG}"
COLOR="${COLOR}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
  docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.app.yml" \
  --env-file "${APP_ENV}" \
  up -d --pull missing

echo "==> Waiting for containers to start"
sleep 8

echo "==> Running Prisma migrations"
SERVICES=(auth-service company-service driver-service fleet-service manifest-service tripsheet-service accounting-service notification-service)
for svc in "${SERVICES[@]}"; do
  echo "  migrate: ${svc}"
  COLOR="${COLOR}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_REGISTRY="${IMAGE_REGISTRY}" \
    docker compose -p "${PROJECT}" -f "${DEPLOY_DIR}/compose.app.yml" --env-file "${APP_ENV}" \
    exec -T "${svc}" npx prisma migrate deploy
done

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

docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d

echo "==> Public smoke checks"
for _ in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/healthz" >/dev/null 2>&1 || curl -fsS "http://${DOMAIN}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS "https://${DOMAIN}/health" >/dev/null 2>&1 \
  || curl -fsS "http://${DOMAIN}/health" >/dev/null 2>&1 \
  || echo "WARN: public /health not reachable yet (DNS/TLS may still be provisioning)"

echo "==> Deployed ${COLOR} (${IMAGE_TAG}) as active"
echo "    Keep the other color running briefly for rollback: ./deploy/scripts/rollback.sh"
