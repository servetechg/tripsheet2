#!/usr/bin/env bash
# Production deploy invoked by GitHub Actions over SSH (runs on the VPS).
# Usage: CI_COMMIT_SHA=<sha> IMAGE_REGISTRY=<reg> ./ci-production-deploy.sh <blue|green> <IMAGE_TAG>
set -euo pipefail

DEPLOY_COLOR="${1:?Usage: ci-production-deploy.sh <blue|green> <IMAGE_TAG>}"
IMAGE_TAG="${2:?Usage: ci-production-deploy.sh <blue|green> <IMAGE_TAG>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
COMMIT_SHA="${CI_COMMIT_SHA:?CI_COMMIT_SHA is required}"

cd "${ROOT_DIR}"
git fetch --all
git checkout --force "${COMMIT_SHA}"
chmod +x deploy/scripts/*.sh

mkdir -p "${SECRETS_DIR}"
touch "${SECRETS_DIR}/app.env"

if [[ ! -f "${SECRETS_DIR}/edge.env" ]]; then
  echo "ERROR: ${SECRETS_DIR}/edge.env is missing."
  echo "Run on the VPS: ${ROOT_DIR}/deploy/scripts/init-secrets.sh"
  exit 1
fi

IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"
grep -q '^IMAGE_REGISTRY=' "${SECRETS_DIR}/app.env" \
  && sed -i "s|^IMAGE_REGISTRY=.*|IMAGE_REGISTRY=${IMAGE_REGISTRY}|" "${SECRETS_DIR}/app.env" \
  || echo "IMAGE_REGISTRY=${IMAGE_REGISTRY}" >> "${SECRETS_DIR}/app.env"
grep -q '^IMAGE_TAG=' "${SECRETS_DIR}/app.env" \
  && sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "${SECRETS_DIR}/app.env" \
  || echo "IMAGE_TAG=${IMAGE_TAG}" >> "${SECRETS_DIR}/app.env"

"${ROOT_DIR}/deploy/scripts/deploy.sh" "${DEPLOY_COLOR}" "${IMAGE_TAG}"

sleep 10
ACTIVE="$(grep -E '^ACTIVE_COLOR=' "${SECRETS_DIR}/edge.env" | cut -d= -f2 || echo "${DEPLOY_COLOR}")"
echo "==> schema-migrate-all via ${ACTIVE}-company-service"
docker exec "${ACTIVE}-company-service" node -e \
  "fetch('http://127.0.0.1:3002/tenants/schema-migrate-all',{method:'POST'}).then(async r=>{console.log(await r.text()); if(!r.ok) process.exit(1)})"

echo "==> Production deploy complete (${ACTIVE}, ${IMAGE_TAG})"
