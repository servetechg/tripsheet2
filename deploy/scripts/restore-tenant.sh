#!/usr/bin/env bash
# Restore a single tenant database from a gzipped pg_dump.
#
# Usage:
#   ./deploy/scripts/restore-tenant.sh fq_tenant_mkx /opt/tripsheet/backups/20260817T020015Z/tenants/fq_tenant_mkx.sql.gz
#   ./deploy/scripts/restore-tenant.sh fq_tenant_mkx ./path/to/fq_tenant_mkx.sql.gz --force
#
# Safety: refuses to restore over an existing DB unless --force is passed.
# After restore, re-check company-service tenant registry (routingMode / status).
set -euo pipefail

DB_NAME="${1:-}"
DUMP_PATH="${2:-}"
FORCE="${3:-}"

if [[ -z "${DB_NAME}" || -z "${DUMP_PATH}" ]]; then
  echo "Usage: $0 <fq_tenant_slug_db> <dump.sql.gz> [--force]"
  exit 1
fi

if [[ ! "${DB_NAME}" =~ ^fq_tenant_[a-z0-9_]+$ ]]; then
  echo "Refusing non-tenant database name: ${DB_NAME}"
  exit 1
fi

if [[ ! -f "${DUMP_PATH}" ]]; then
  echo "Dump not found: ${DUMP_PATH}"
  exit 1
fi

SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose.infra.yml"
POSTGRES_USER="${POSTGRES_USER:-tripsheet}"

# shellcheck disable=SC1090
if [[ -f "${SECRETS_DIR}/infra.env" ]]; then
  source "${SECRETS_DIR}/infra.env"
fi

psql_exec() {
  docker compose -f "${COMPOSE_FILE}" \
    ${SECRETS_DIR:+--env-file "${SECRETS_DIR}/infra.env"} \
    exec -T postgres "$@"
}

EXISTS="$(psql_exec psql -U "${POSTGRES_USER}" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | tr -d '[:space:]')"

if [[ "${EXISTS}" == "1" && "${FORCE}" != "--force" ]]; then
  echo "Database ${DB_NAME} already exists. Pass --force to drop and restore."
  exit 2
fi

if [[ "${EXISTS}" == "1" && "${FORCE}" == "--force" ]]; then
  echo "==> Terminating connections and dropping ${DB_NAME}"
  psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"
  psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
    "DROP DATABASE \"${DB_NAME}\";"
fi

echo "==> Creating ${DB_NAME}"
psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"${DB_NAME}\" OWNER \"${POSTGRES_USER}\";"

echo "==> Restoring from ${DUMP_PATH}"
gunzip -c "${DUMP_PATH}" | psql_exec psql -U "${POSTGRES_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1

echo "==> Restore complete for ${DB_NAME}"
echo "    Smoke: SELECT COUNT(*) FROM driver.\"Driver\"; (via psql -d ${DB_NAME})"
echo "    Confirm registry row still points at this dbName in company_db."
