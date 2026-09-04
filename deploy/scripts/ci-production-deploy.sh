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

# shellcheck disable=SC1090
source "${SECRETS_DIR}/edge.env"
echo "==> Verifying public production UI (${DOMAIN})"
for _ in $(seq 1 15); do
  html="$(curl -fsS "https://${DOMAIN}/login" 2>/dev/null || curl -fsS "http://${DOMAIN}/login" 2>/dev/null || true)"
  if [[ -n "${html}" ]]; then
    break
  fi
  sleep 2
done
if [[ -z "${html}" ]]; then
  echo "WARN: could not fetch ${DOMAIN}/login for UI verification"
elif grep -q 'Welcome back' <<<"${html}"; then
  echo "ERROR: ${DOMAIN} still serves old login UI (Caddy may be routing to stale color)"
  echo "    edge ACTIVE_COLOR=${ACTIVE}"
  docker inspect "${ACTIVE}-frontend" --format '    ${ACTIVE}-frontend image: {{.Config.Image}}' 2>/dev/null || true
  other=$([[ "${ACTIVE}" == "blue" ]] && echo green || echo blue)
  docker inspect "${other}-frontend" --format "    ${other}-frontend image: {{.Config.Image}}" 2>/dev/null || true
  docker compose -f "${ROOT_DIR}/deploy/compose.edge.yml" --env-file "${SECRETS_DIR}/edge.env" up -d --force-recreate caddy
  sleep 5
  html="$(curl -fsS "https://${DOMAIN}/login" 2>/dev/null || curl -fsS "http://${DOMAIN}/login" 2>/dev/null || true)"
  if grep -q 'Welcome back' <<<"${html}"; then
    exit 1
  fi
  echo "    recovered after caddy recreate"
else
  echo "    public login UI OK"
fi

echo "==> Production deploy complete (${ACTIVE}, ${IMAGE_TAG})"
