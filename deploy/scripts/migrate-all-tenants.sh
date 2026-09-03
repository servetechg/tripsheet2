#!/usr/bin/env bash
# Phase 6: migrate schemas across all active tenants (CI/CD + ops).
#
# Usage:
#   COMPANY_URL=http://localhost:3002 ./deploy/scripts/migrate-all-tenants.sh
#   ./deploy/scripts/migrate-all-tenants.sh --cli
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-http}"
BASE="${COMPANY_URL:-http://localhost:3002}"
BASE="${BASE%/}"

if [[ "${MODE}" == "--cli" || "${MODE}" == "cli" ]]; then
  echo "==> CLI: schema migrate via company-service"
  cd "${ROOT}/backend/services/company-service"
  npm run schema:migrate-all
  echo "==> migrate-all-tenants CLI complete"
  exit 0
fi

echo "==> HTTP: schema-migrate-all at ${BASE}"
curl -sS -f -X POST "${BASE}/tenants/schema-migrate-all" -H 'Content-Type: application/json'
echo
echo "==> migrate-all-tenants HTTP complete"
