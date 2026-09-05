#!/usr/bin/env bash
# DESTRUCTIVE: wipe TripSheet databases and re-seed super admin + plans only.
#
# Usage (on VPS as deploy):
#   ./deploy/scripts/reset-fresh.sh --production --force
#   ./deploy/scripts/reset-fresh.sh --staging --force
#   ./deploy/scripts/reset-fresh.sh --all --force
#
# Requires app stacks stopped or tolerate brief downtime.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
INFRA_ENV="${SECRETS_DIR}/infra.env"
EDGE_ENV="${SECRETS_DIR}/edge.env"

DO_PROD=0
DO_STAGING=0
FORCE=0

for arg in "$@"; do
  case "${arg}" in
    --production) DO_PROD=1 ;;
    --staging) DO_STAGING=1 ;;
    --all) DO_PROD=1; DO_STAGING=1 ;;
    --force) FORCE=1 ;;
    *)
      echo "Unknown arg: ${arg}"
      echo "Usage: reset-fresh.sh (--production | --staging | --all) --force"
      exit 1
      ;;
  esac
done

if [[ "${DO_PROD}" -eq 0 && "${DO_STAGING}" -eq 0 ]]; then
  echo "Pick --production, --staging, or --all"
  exit 1
fi

if [[ "${FORCE}" -ne 1 ]]; then
  echo "This deletes ALL TripSheet data in the selected environment(s)."
  echo "Re-run with --force to continue."
  exit 1
fi

# shellcheck disable=SC1090
source "${INFRA_ENV}"

psql_exec() {
  docker compose -f "${DEPLOY_DIR}/compose.infra.yml" --env-file "${INFRA_ENV}" \
    exec -T postgres psql -U "${POSTGRES_USER}" -d postgres "$@"
}

drop_db() {
  local db="$1"
  echo "  drop/recreate ${db}"
  psql_exec -v ON_ERROR_STOP=1 -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${db}' AND pid <> pg_backend_pid();
  " >/dev/null 2>&1 || true
  psql_exec -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${db}\";"
  psql_exec -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db}\";"
  psql_exec -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE \"${db}\" TO \"${POSTGRES_USER}\";"
}

drop_tenant_dbs() {
  echo "==> Dropping fq_tenant_* databases"
  mapfile -t TENANTS < <(
    psql_exec -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'fq_tenant_%' ORDER BY 1"
  )
  for db in "${TENANTS[@]:-}"; do
    [[ -z "${db}" ]] && continue
    drop_db "${db}"
  done
}

reset_service_dbs() {
  local suffix="$1"
  local dbs=(
    "auth_db${suffix}"
    "company_db${suffix}"
    "driver_db${suffix}"
    "fleet_db${suffix}"
    "manifest_db${suffix}"
    "tripsheet_db${suffix}"
    "accounting_db${suffix}"
    "notification_db${suffix}"
  )
  echo "==> Resetting service databases (${suffix:-production})"
  for db in "${dbs[@]}"; do
    drop_db "${db}"
  done
}

migrate_and_seed() {
  local project="$1"
  local compose_file="$2"
  local env_file="$3"
  local prefix="$4"
  local stack_color="${5:-blue}"
  local root="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

  echo "==> migrate + seed via ${project} (COLOR=${stack_color})"
  COLOR="${stack_color}" IMAGE_TAG="${IMAGE_TAG:-latest}" \
    "${root}/deploy/scripts/run-prisma-migrations.sh" "${project}" "${compose_file}" "${env_file}"

  echo "  seed auth-service (super admin only)"
  COLOR="${stack_color}" docker compose -p "${project}" -f "${compose_file}" --env-file "${env_file}" \
    run --rm --no-deps --name "seed-auth-$$" auth-service npx prisma db seed

  echo "  seed company-service (plans only)"
  COLOR="${stack_color}" docker compose -p "${project}" -f "${compose_file}" --env-file "${env_file}" \
    run --rm --no-deps --name "seed-company-$$" company-service npx prisma db seed

  echo "  optional no-op seeds"
  for svc in driver-service fleet-service manifest-service; do
    COLOR="${stack_color}" docker compose -p "${project}" -f "${compose_file}" --env-file "${env_file}" \
      run --rm --no-deps --name "seed-${svc}-$$" "${svc}" npx prisma db seed || true
  done

  echo "==> ${prefix} reset complete"
}

set_active_color() {
  local color="$1"
  local tmp
  tmp="$(mktemp)"
  awk -v c="${color}" '
    BEGIN{updated=0}
    /^ACTIVE_COLOR=/ { print "ACTIVE_COLOR=" c; updated=1; next }
    { print }
    END { if (!updated) print "ACTIVE_COLOR=" c }
  ' "${EDGE_ENV}" > "${tmp}"
  mv "${tmp}" "${EDGE_ENV}"
  echo "ACTIVE_COLOR=${color}" > "${DEPLOY_DIR}/caddy/active.env"
  docker compose -f "${DEPLOY_DIR}/compose.edge.yml" --env-file "${EDGE_ENV}" up -d --force-recreate caddy
  echo "==> Edge ACTIVE_COLOR=${color} (Caddy recreated)"
}

echo "==> Stopping app containers (infra stays up)"
if [[ "${DO_PROD}" -eq 1 ]]; then
  docker compose -p tripsheet-blue -f "${DEPLOY_DIR}/compose.app.yml" --env-file "${SECRETS_DIR}/app.env" down || true
  docker compose -p tripsheet-green -f "${DEPLOY_DIR}/compose.app.yml" --env-file "${SECRETS_DIR}/app.env" down || true
fi
if [[ "${DO_STAGING}" -eq 1 ]]; then
  docker compose -p tripsheet-staging -f "${DEPLOY_DIR}/compose.staging.yml" --env-file "${SECRETS_DIR}/staging.app.env" down || true
fi

drop_tenant_dbs

if [[ "${DO_PROD}" -eq 1 ]]; then
  reset_service_dbs ""
  migrate_and_seed "tripsheet-blue" "${DEPLOY_DIR}/compose.app.yml" "${SECRETS_DIR}/app.env" "production" blue
  set_active_color blue
  echo "Redeploy production: ./deploy/scripts/deploy.sh blue latest"
fi

if [[ "${DO_STAGING}" -eq 1 ]]; then
  reset_service_dbs "_staging"
  migrate_and_seed "tripsheet-staging" "${DEPLOY_DIR}/compose.staging.yml" "${SECRETS_DIR}/staging.app.env" "staging"
  echo "Redeploy staging: ./deploy/scripts/deploy-staging.sh staging"
fi

echo "==> Done. Login: admin@tripsheet.io / admin123"
echo "    Create companies from Super Admin UI after login."
