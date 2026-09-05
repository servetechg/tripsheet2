#!/usr/bin/env bash
# Fix production HTTP 502: sync ACTIVE_COLOR to a running stack and recreate Caddy.
# Usage: ./deploy/scripts/repair-production-edge.sh [blue|green]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
APP_ENV="${SECRETS_DIR}/app.env"
EDGE_ENV="${SECRETS_DIR}/edge.env"

if [[ ! -f "${APP_ENV}" || ! -f "${EDGE_ENV}" ]]; then
  echo "Missing ${APP_ENV} or ${EDGE_ENV}"
  exit 1
fi

# shellcheck disable=SC1090
source "${APP_ENV}"
# shellcheck disable=SC1090
source "${EDGE_ENV}"

REQUESTED="${1:-}"

stack_healthy() {
  local color="$1"
  docker ps --format '{{.Names}}' | grep -qx "${color}-gateway" || return 1
  docker ps --format '{{.Names}}' | grep -qx "${color}-frontend" || return 1
  docker exec "${color}-gateway" wget -qO- "http://127.0.0.1:3000/health" >/dev/null 2>&1 || return 1
  docker exec "${color}-gateway" wget -qO- "http://${color}-frontend:80/healthz" >/dev/null 2>&1 || return 1
}

pick_color() {
  if [[ -n "${REQUESTED}" ]]; then
    echo "${REQUESTED}"
    return
  fi
  if stack_healthy "${ACTIVE_COLOR:-blue}"; then
    echo "${ACTIVE_COLOR:-blue}"
    return
  fi
  if stack_healthy blue; then
    echo blue
    return
  fi
  if stack_healthy green; then
    echo green
    return
  fi
  echo blue
}

TARGET="$(pick_color)"
echo "==> Target color: ${TARGET}"

if ! stack_healthy "${TARGET}"; then
  echo "==> ${TARGET} stack not healthy — starting it (tag ${IMAGE_TAG:-latest})"
  COLOR="${TARGET}" IMAGE_TAG="${IMAGE_TAG:-latest}" IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY required}" \
    "${ROOT_DIR}/deploy/scripts/deploy.sh" "${TARGET}" "${IMAGE_TAG:-latest}"
  exit 0
fi

echo "==> Updating edge.env ACTIVE_COLOR=${TARGET}"
tmp="$(mktemp)"
awk -v c="${TARGET}" '
  BEGIN{updated=0}
  /^ACTIVE_COLOR=/ { print "ACTIVE_COLOR=" c; updated=1; next }
  { print }
  END { if (!updated) print "ACTIVE_COLOR=" c }
' "${EDGE_ENV}" > "${tmp}"
mv "${tmp}" "${EDGE_ENV}"
echo "ACTIVE_COLOR=${TARGET}" > "${DEPLOY_DIR}/caddy/active.env"

echo "==> Recreating Caddy"
docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d --force-recreate caddy

sleep 3
echo "==> Smoke checks"
curl -fsS "https://${DOMAIN}/healthz" >/dev/null 2>&1 \
  || curl -fsS "http://${DOMAIN}/healthz" >/dev/null 2>&1 \
  || echo "WARN: /healthz not reachable"

if curl -fsS "https://${DOMAIN}/login" >/dev/null 2>&1 \
  || curl -fsS "http://${DOMAIN}/login" >/dev/null 2>&1; then
  echo "==> Production login page OK (${DOMAIN})"
else
  echo "ERROR: ${DOMAIN}/login still not reachable — check: docker ps | grep -E 'blue|green|caddy'"
  exit 1
fi
