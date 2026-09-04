#!/usr/bin/env bash
# First-time VPS bootstrap after Docker is installed.
# Run as deploy user from the repo root on the VPS (or after cloning into /opt/tripsheet/repo).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"

echo "==> Creating docker network tripsheet-net"
docker network create tripsheet-net 2>/dev/null || true

if [[ ! -f "${SECRETS_DIR}/infra.env" || ! -f "${SECRETS_DIR}/app.env" || ! -f "${SECRETS_DIR}/edge.env" ]]; then
  echo "Missing secrets in ${SECRETS_DIR}."
  echo "Copy deploy/secrets.example.env fields into:"
  echo "  ${SECRETS_DIR}/infra.env"
  echo "  ${SECRETS_DIR}/app.env"
  echo "  ${SECRETS_DIR}/edge.env"
  exit 1
fi

# Sync ACTIVE_COLOR into Caddy env file used by compose.edge
# shellcheck disable=SC1091
source "${SECRETS_DIR}/edge.env"
echo "ACTIVE_COLOR=${ACTIVE_COLOR:-blue}" > "${DEPLOY_DIR}/caddy/active.env"

echo "==> Starting shared Postgres + Redis"
docker compose -f "${DEPLOY_DIR}/compose.infra.yml" --env-file "${SECRETS_DIR}/infra.env" up -d

echo "==> Waiting for Postgres"
for i in {1..60}; do
  if docker compose -f "${DEPLOY_DIR}/compose.infra.yml" --env-file "${SECRETS_DIR}/infra.env" exec -T postgres pg_isready -U tripsheet >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  sleep 2
done

echo "==> Bootstrap complete. Next: ./deploy/scripts/deploy.sh blue <IMAGE_TAG>"
