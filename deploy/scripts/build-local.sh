#!/usr/bin/env bash
# Build all images locally (first VPS bring-up before GHCR CI is ready).
# Usage: ./deploy/scripts/build-local.sh [tag]
set -euo pipefail

TAG="${1:-local}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${IMAGE_REGISTRY:-tripsheet}"

echo "==> Building images as ${REGISTRY}/*:${TAG}"

docker build -t "${REGISTRY}/gateway:${TAG}" -f "${ROOT_DIR}/backend/gateway/Dockerfile" "${ROOT_DIR}/backend/gateway"

for svc in auth-service company-service driver-service fleet-service manifest-service tripsheet-service accounting-service notification-service; do
  docker build -t "${REGISTRY}/${svc}:${TAG}" \
    -f "${ROOT_DIR}/backend/services/${svc}/Dockerfile" \
    "${ROOT_DIR}/backend/services/${svc}"
done

docker build \
  --build-arg VITE_API_URL=/api \
  -t "${REGISTRY}/frontend:${TAG}" \
  -f "${ROOT_DIR}/frontend/Dockerfile" \
  "${ROOT_DIR}"

echo "==> Done. Set IMAGE_REGISTRY=${REGISTRY} and run:"
echo "    ./deploy/scripts/deploy.sh blue ${TAG}"
