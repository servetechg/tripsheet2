#!/usr/bin/env bash
# Provision all pending/failed tenant DBs via company-service API.
# Usage:
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/provision-tenant.sh
#   COMPANY_URL=http://localhost:3001/api ./deploy/scripts/provision-tenant.sh   # via gateway
#   ./deploy/scripts/provision-tenant.sh <companyId>   # single tenant retry

set -euo pipefail

BASE="${COMPANY_URL:-http://localhost:3002}"
BASE="${BASE%/}"

if [[ $# -ge 1 ]]; then
  CID="$1"
  FORCE="${2:-true}"
  echo "Provisioning tenant $CID (force=$FORCE)..."
  curl -sS -X POST "$BASE/tenants/$CID/provision" \
    -H 'Content-Type: application/json' \
    -d "{\"force\": $FORCE}"
  echo
else
  echo "Provisioning all pending/failed tenants at $BASE ..."
  curl -sS -X POST "$BASE/tenants/provision-pending" \
    -H 'Content-Type: application/json'
  echo
fi
