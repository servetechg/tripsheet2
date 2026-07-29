#!/usr/bin/env bash
# Nightly Postgres backup for all TripSheet databases.
# Usage: ./deploy/scripts/backup.sh
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/tripsheet/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_ROOT}/${STAMP}"
mkdir -p "${OUT_DIR}"

# shellcheck disable=SC1090
source "${SECRETS_DIR}/infra.env"

DBS=(
  auth_db company_db driver_db fleet_db manifest_db tripsheet_db accounting_db notification_db
  auth_db_staging company_db_staging driver_db_staging fleet_db_staging
  manifest_db_staging tripsheet_db_staging accounting_db_staging notification_db_staging
)

echo "==> Backing up to ${OUT_DIR}"
for db in "${DBS[@]}"; do
  if docker compose -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose.infra.yml" \
    --env-file "${SECRETS_DIR}/infra.env" \
    exec -T postgres psql -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    docker compose -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose.infra.yml" \
      --env-file "${SECRETS_DIR}/infra.env" \
      exec -T postgres pg_dump -U "${POSTGRES_USER}" "${db}" | gzip > "${OUT_DIR}/${db}.sql.gz"
    echo "  wrote ${db}.sql.gz"
  else
    echo "  skip ${db} (missing)"
  fi
done

# Keep 14 daily dirs
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "==> Backup complete"
