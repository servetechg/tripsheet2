#!/usr/bin/env bash
# Quarterly restore drill: restore one tenant dump into a throwaway DB, verify, drop.
#
# Usage:
#   ./deploy/scripts/restore-drill.sh
#   BACKUP_ROOT=/opt/tripsheet/backups ./deploy/scripts/restore-drill.sh fq_tenant_mkx
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/tripsheet/backups}"
TARGET_DB="${1:-}"

LATEST="$(ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | head -n1 || true)"
if [[ -z "${LATEST}" ]]; then
  echo "No backups under ${BACKUP_ROOT}"
  exit 1
fi

TENANT_DIR="${LATEST%/}/tenants"
if [[ ! -d "${TENANT_DIR}" ]]; then
  echo "No tenants/ folder in ${LATEST}"
  exit 1
fi

if [[ -z "${TARGET_DB}" ]]; then
  TARGET_DB="$(basename "$(ls -1 "${TENANT_DIR}"/*.sql.gz 2>/dev/null | head -n1)" .sql.gz || true)"
fi

DUMP="${TENANT_DIR}/${TARGET_DB}.sql.gz"
if [[ -z "${TARGET_DB}" || ! -f "${DUMP}" ]]; then
  echo "Dump not found for ${TARGET_DB:-<none>} in ${TENANT_DIR}"
  exit 1
fi

DRILL_DB="${TARGET_DB}_drill_$(date -u +%Y%m%d)"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
COMPOSE_FILE="${ROOT}/compose.infra.yml"
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

echo "==> Restore drill: ${DUMP} → ${DRILL_DB}"
psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS \"${DRILL_DB}\";"
psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"${DRILL_DB}\" OWNER \"${POSTGRES_USER}\";"
gunzip -c "${DUMP}" | psql_exec psql -U "${POSTGRES_USER}" -d "${DRILL_DB}" -v ON_ERROR_STOP=1

SCHEMAS="$(psql_exec psql -U "${POSTGRES_USER}" -d "${DRILL_DB}" -tAc \
  "SELECT count(*) FROM pg_namespace WHERE nspname IN ('driver','fleet','company_local','accounting')" \
  | tr -d '[:space:]')"

echo "  schemas_present_marker=${SCHEMAS}"
if [[ "${SCHEMAS}" -lt 1 ]]; then
  echo "FAIL: expected tenant schemas missing"
  exit 1
fi

psql_exec psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE \"${DRILL_DB}\";"

echo "==> Restore drill PASSED (${TARGET_DB})"
echo "    Record date in ops calendar; next drill due in ~90 days."
