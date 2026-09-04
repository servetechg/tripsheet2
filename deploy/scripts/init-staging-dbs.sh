#!/usr/bin/env bash
# Create staging databases on the shared Postgres instance.
# Usage: ./deploy/scripts/init-staging-dbs.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
SQL_FILE="${DEPLOY_DIR}/docker/init-staging-databases.sql"

if [[ ! -f "${SECRETS_DIR}/infra.env" ]]; then
  echo "Missing ${SECRETS_DIR}/infra.env"
  exit 1
fi

echo "==> Creating staging databases (ignores errors if they already exist)"
docker compose -f "${DEPLOY_DIR}/compose.infra.yml" --env-file "${SECRETS_DIR}/infra.env" \
  exec -T postgres psql -U tripsheet -d postgres < "${SQL_FILE}" \
  || true

echo "==> Listing databases"
docker compose -f "${DEPLOY_DIR}/compose.infra.yml" --env-file "${SECRETS_DIR}/infra.env" \
  exec -T postgres psql -U tripsheet -d postgres -c '\l' | grep -E 'staging|Name' || true

echo "==> Done"
