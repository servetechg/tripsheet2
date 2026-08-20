#!/usr/bin/env bash
# Nightly Postgres backup: platform DBs + all fq_tenant_* databases.
# Usage: ./deploy/scripts/backup.sh
# Cron (example): 15 2 * * * /opt/tripsheet/repo/deploy/scripts/backup.sh >> /var/log/tripsheet-backup.log 2>&1
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/tripsheet/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_ROOT}/${STAMP}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose.infra.yml"

mkdir -p "${OUT_DIR}"

# shellcheck disable=SC1090
if [[ -f "${SECRETS_DIR}/infra.env" ]]; then
  source "${SECRETS_DIR}/infra.env"
fi
POSTGRES_USER="${POSTGRES_USER:-tripsheet}"

psql_exec() {
  docker compose -f "${COMPOSE_FILE}" \
    ${SECRETS_DIR:+--env-file "${SECRETS_DIR}/infra.env"} \
    exec -T postgres "$@"
}

echo "==> Backing up to ${OUT_DIR}"

# Platform / shared microservice DBs
SHARED_DBS=(
  auth_db company_db driver_db fleet_db manifest_db tripsheet_db accounting_db notification_db
  auth_db_staging company_db_staging driver_db_staging fleet_db_staging
  manifest_db_staging tripsheet_db_staging accounting_db_staging notification_db_staging
)

for db in "${SHARED_DBS[@]}"; do
  if psql_exec psql -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    psql_exec pg_dump -U "${POSTGRES_USER}" --no-owner --no-acl "${db}" | gzip > "${OUT_DIR}/${db}.sql.gz"
    echo "  wrote ${db}.sql.gz"
  else
    echo "  skip ${db} (missing)"
  fi
done

# Phase 6: every dedicated tenant database
mapfile -t TENANT_DBS < <(
  psql_exec psql -U "${POSTGRES_USER}" -d postgres -tAc \
    "SELECT datname FROM pg_database WHERE datname LIKE 'fq_tenant_%' ORDER BY 1" \
    | tr -d '\r' | sed '/^$/d'
)

mkdir -p "${OUT_DIR}/tenants"
for db in "${TENANT_DBS[@]:-}"; do
  [[ -z "${db}" ]] && continue
  psql_exec pg_dump -U "${POSTGRES_USER}" --no-owner --no-acl "${db}" | gzip > "${OUT_DIR}/tenants/${db}.sql.gz"
  echo "  wrote tenants/${db}.sql.gz"
done

# Manifest for restore drills
{
  echo "stamp=${STAMP}"
  echo "shared_count=${#SHARED_DBS[@]}"
  echo "tenant_count=${#TENANT_DBS[@]}"
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "${OUT_DIR}/MANIFEST.txt"

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
echo "==> Backup complete (${#TENANT_DBS[@]} tenants, retention ${RETENTION_DAYS}d)"
