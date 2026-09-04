#!/usr/bin/env bash
# Phase 4 ETL / cutover helpers via company-service API.
# Usage:
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh <companyId>
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh <companyId> cutover
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-tenant.sh <companyId> archive

set -euo pipefail

BASE="${COMPANY_URL:-http://localhost:3002}"
BASE="${BASE%/}"

if [[ $# -eq 0 ]]; then
  echo "ETL migrate-all at $BASE ..."
  curl -sS -X POST "$BASE/tenants/migrate-all" -H 'Content-Type: application/json'
  echo
  exit 0
fi

CID="$1"
ACTION="${2:-migrate}"

case "$ACTION" in
  migrate)
    echo "Migrating $CID ..."
    curl -sS -X POST "$BASE/tenants/$CID/migrate" -H 'Content-Type: application/json' -d '{}'
    ;;
  verify)
    curl -sS -X POST "$BASE/tenants/$CID/verify" -H 'Content-Type: application/json'
    ;;
  freeze)
    curl -sS -X POST "$BASE/tenants/$CID/freeze" -H 'Content-Type: application/json' -d '{"freeze":true}'
    ;;
  cutover)
    curl -sS -X POST "$BASE/tenants/$CID/cutover" -H 'Content-Type: application/json' -d '{}'
    ;;
  archive)
    curl -sS -X POST "$BASE/tenants/$CID/archive-shared" -H 'Content-Type: application/json' -d '{}'
    ;;
  *)
    echo "Unknown action: $ACTION (migrate|verify|freeze|cutover|archive)"
    exit 1
    ;;
esac
echo
