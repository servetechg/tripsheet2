#!/usr/bin/env bash
# Write split secret files from prompts / generated values.
# Usage on VPS: ./deploy/scripts/init-secrets.sh
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
mkdir -p "${SECRETS_DIR}"
chmod 700 "${SECRETS_DIR}"

read -r -p "VPS public IPv4: " VPS_IP
read -r -p "ACME email for HTTPS: " ACME_EMAIL
read -r -p "GitHub org/repo for GHCR (e.g. myorg/tripsheet) or 'tripsheet' for local: " IMAGE_REGISTRY_INPUT

DOMAIN="tripsheet.${VPS_IP}.sslip.io"
POSTGRES_PASSWORD="$(openssl rand -hex 32)"
REDIS_PASSWORD="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -base64 48)"
INTERNAL_API_KEY="$(openssl rand -hex 32)"
IMAGE_REGISTRY="${IMAGE_REGISTRY_INPUT:-tripsheet}"

cat > "${SECRETS_DIR}/infra.env" <<EOF
POSTGRES_USER=tripsheet
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF

cat > "${SECRETS_DIR}/app.env" <<EOF
POSTGRES_USER=tripsheet
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
INTERNAL_API_KEY=${INTERNAL_API_KEY}
CORS_ORIGIN=https://${DOMAIN}
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=tripsheet/documents
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
IMAGE_REGISTRY=${IMAGE_REGISTRY}
IMAGE_TAG=local
COLOR=blue
EOF

cat > "${SECRETS_DIR}/edge.env" <<EOF
DOMAIN=${DOMAIN}
ACTIVE_COLOR=blue
CADDY_ACME_EMAIL=${ACME_EMAIL}
EOF

chmod 600 "${SECRETS_DIR}/"*.env
echo "Wrote secrets to ${SECRETS_DIR}"
echo "Domain: https://${DOMAIN}"
echo "Verify DNS: dig +short ${DOMAIN}"
