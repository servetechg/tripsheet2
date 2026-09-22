#!/usr/bin/env bash
# Encode Firebase service account JSON for FIREBASE_SERVICE_ACCOUNT_JSON_B64 in app.env.
# Usage: ./deploy/scripts/firebase-service-account-b64.sh /path/to/service-account.json
set -euo pipefail

JSON_PATH="${1:?Usage: firebase-service-account-b64.sh /path/to/service-account.json}"
if [[ ! -f "${JSON_PATH}" ]]; then
  echo "File not found: ${JSON_PATH}"
  exit 1
fi

if command -v base64 >/dev/null 2>&1; then
  if base64 --help 2>&1 | grep -q '\-w'; then
    B64="$(base64 -w0 "${JSON_PATH}")"
  else
    B64="$(base64 "${JSON_PATH}" | tr -d '\n')"
  fi
else
  echo "base64 command not found"
  exit 1
fi

PROJECT_ID="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(j.project_id||'')" "${JSON_PATH}")"

echo "# Paste into /opt/tripsheet/secrets/app.env and staging.app.env"
echo "FIREBASE_PROJECT_ID=${PROJECT_ID}"
echo "FIREBASE_SERVICE_ACCOUNT_JSON_B64=${B64}"
