#!/usr/bin/env bash
# Switch Caddy back to the previous color without rebuilding.
# Usage: ./deploy/scripts/rollback.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
EDGE_ENV="${SECRETS_DIR}/edge.env"

# shellcheck disable=SC1090
source "${EDGE_ENV}"

current="${ACTIVE_COLOR:-blue}"
if [[ "${current}" == "blue" ]]; then
  target="green"
else
  target="blue"
fi

if ! docker compose -p "tripsheet-${target}" -f "${DEPLOY_DIR}/compose.app.yml" --env-file "${SECRETS_DIR}/app.env" ps --status running 2>/dev/null | grep -q gateway; then
  echo "Rollback target tripsheet-${target} is not running. Aborting."
  exit 1
fi

echo "==> Rolling back ${current} -> ${target}"
tmp="$(mktemp)"
awk -v c="${target}" '
  BEGIN{updated=0}
  /^ACTIVE_COLOR=/ { print "ACTIVE_COLOR=" c; updated=1; next }
  { print }
  END { if (!updated) print "ACTIVE_COLOR=" c }
' "${EDGE_ENV}" > "${tmp}"
mv "${tmp}" "${EDGE_ENV}"
echo "ACTIVE_COLOR=${target}" > "${DEPLOY_DIR}/caddy/active.env"

docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d
echo "==> Traffic now on ${target}"
