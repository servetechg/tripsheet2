#!/usr/bin/env bash
# Build all images locally (first VPS bring-up before GHCR CI is ready).
# Usage: ./deploy/scripts/build-local.sh [tag]
set -euo pipefail

TAG="${1:-local}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${IMAGE_REGISTRY:-tripsheet}"

echo "==> Building images as ${REGISTRY}/*:${TAG}"

docker build -t "${REGISTRY}/gateway:${TAG}" -f "${ROOT_DIR}/backend/gateway/Dockerfile" "${ROOT_DIR}"

BACKEND_ENV="${ROOT_DIR}/backend/.env"
FRONTEND_ENV="${ROOT_DIR}/frontend/.env"
if [[ -f "${BACKEND_ENV}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${BACKEND_ENV}"
  set +a
  echo "==> Loaded backend/.env (Firebase server + VITE_FIREBASE_* for frontend image)"
fi
if [[ -f "${FRONTEND_ENV}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${FRONTEND_ENV}"
  set +a
  echo "==> Loaded frontend/.env overrides"
fi

for svc in auth-service company-service driver-service fleet-service manifest-service tripsheet-service accounting-service notification-service; do
  docker build -t "${REGISTRY}/${svc}:${TAG}" \
    -f "${ROOT_DIR}/backend/services/${svc}/Dockerfile" \
    "${ROOT_DIR}"
done

docker build \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY:-}" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN:-}" \
  --build-arg VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-}" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET:-}" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID:-}" \
  --build-arg VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID:-}" \
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="${VITE_FIREBASE_MEASUREMENT_ID:-}" \
  --build-arg VITE_FIREBASE_VAPID_KEY="${VITE_FIREBASE_VAPID_KEY:-}" \
  -t "${REGISTRY}/frontend:${TAG}" \
  -f "${ROOT_DIR}/frontend/Dockerfile" \
  "${ROOT_DIR}"

echo "==> Done. Set IMAGE_REGISTRY=${REGISTRY} and run:"
echo "    ./deploy/scripts/deploy.sh blue ${TAG}"
