#!/usr/bin/env bash
# Run Prisma migrate deploy for each backend service using ephemeral containers.
# Avoids OOM (exit 137) on small VPS hosts — do not exec into running app containers.
#
# Usage:
#   ./deploy/scripts/run-prisma-migrations.sh <compose_project> <compose_file> <env_file>
#
# Example:
#   ./deploy/scripts/run-prisma-migrations.sh tripsheet-staging deploy/compose.staging.yml /opt/tripsheet/secrets/staging.app.env
set -euo pipefail

PROJECT="${1:?compose project name}"
COMPOSE_FILE="${2:?compose file path}"
ENV_FILE="${3:?env file path}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ "${COMPOSE_FILE}" = /* ]]; then
  COMPOSE_PATH="${COMPOSE_FILE}"
else
  COMPOSE_PATH="${ROOT_DIR}/${COMPOSE_FILE}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

export IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG must be set}"
export IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY must be set}"
export COLOR="${COLOR:-}"

COMPOSE=(docker compose -p "${PROJECT}" -f "${COMPOSE_PATH}" --env-file "${ENV_FILE}")

APP_SERVICES=(
  gateway
  frontend
  auth-service
  company-service
  driver-service
  fleet-service
  manifest-service
  tripsheet-service
  accounting-service
  notification-service
)

MIGRATE_SERVICES=(
  auth-service
  company-service
  driver-service
  fleet-service
  manifest-service
  tripsheet-service
  accounting-service
  notification-service
)

echo "==> Pausing app stack to free memory for migrations (${PROJECT})"
"${COMPOSE[@]}" stop "${APP_SERVICES[@]}" 2>/dev/null || true

prisma_migrate() {
  local svc="$1"
  local run_name="migrate-${svc}-$$-${RANDOM}"
  echo "  migrate: ${svc}"
  # One-off container on tripsheet-net; --no-deps avoids starting the full stack.
  "${COMPOSE[@]}" run --rm --no-deps --name "${run_name}" "${svc}" \
    node node_modules/prisma/build/index.js migrate deploy
}

for svc in "${MIGRATE_SERVICES[@]}"; do
  prisma_migrate "${svc}"
  sleep 1
done

echo "==> Prisma migrations complete (${PROJECT})"
