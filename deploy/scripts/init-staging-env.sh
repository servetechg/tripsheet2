#!/usr/bin/env bash
# Add staging secrets to an existing VPS install (does not overwrite prod passwords).
# Usage: ./deploy/scripts/init-staging-env.sh
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/tripsheet/secrets}"
EDGE_ENV="${SECRETS_DIR}/edge.env"
APP_ENV="${SECRETS_DIR}/app.env"
STAGING_ENV="${SECRETS_DIR}/staging.app.env"

if [[ ! -f "${EDGE_ENV}" || ! -f "${APP_ENV}" ]]; then
  echo "Missing ${EDGE_ENV} or ${APP_ENV}. Run init-secrets.sh first for a new install."
  exit 1
fi

# shellcheck disable=SC1090
source "${APP_ENV}"
# shellcheck disable=SC1090
source "${EDGE_ENV}"

if [[ -z "${DOMAIN:-}" ]]; then
  echo "DOMAIN missing in edge.env"
  exit 1
fi

# Derive staging host from prod domain if possible
if [[ -z "${STAGING_DOMAIN:-}" ]]; then
  if [[ "${DOMAIN}" == tripsheet.* ]]; then
    STAGING_DOMAIN="staging.${DOMAIN}"
  else
    read -r -p "Staging hostname (e.g. staging.tripsheet.x.x.x.x.sslip.io): " STAGING_DOMAIN
  fi
fi

JWT_SECRET_STAGING="$(openssl rand -base64 48)"
INTERNAL_API_KEY_STAGING="$(openssl rand -hex 32)"

if [[ ! -f "${STAGING_ENV}" ]]; then
  cat > "${STAGING_ENV}" <<EOF
POSTGRES_USER=${POSTGRES_USER:-tripsheet}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET_STAGING}
JWT_EXPIRES_IN=7d
INTERNAL_API_KEY=${INTERNAL_API_KEY_STAGING}
CORS_ORIGIN=https://${STAGING_DOMAIN}
CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}
CLOUDINARY_FOLDER=tripsheet/staging/documents
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:-}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-}
TWILIO_FROM_NUMBER=${TWILIO_FROM_NUMBER:-}
IMAGE_REGISTRY=${IMAGE_REGISTRY:-tripsheet}
IMAGE_TAG=local
EOF
  chmod 600 "${STAGING_ENV}"
  echo "Wrote ${STAGING_ENV}"
else
  echo "Keeping existing ${STAGING_ENV}"
fi

# Ensure STAGING_DOMAIN is in edge.env
if grep -q '^STAGING_DOMAIN=' "${EDGE_ENV}"; then
  tmp="$(mktemp)"
  awk -v d="${STAGING_DOMAIN}" '
    /^STAGING_DOMAIN=/ { print "STAGING_DOMAIN=" d; next }
    { print }
  ' "${EDGE_ENV}" > "${tmp}"
  mv "${tmp}" "${EDGE_ENV}"
else
  echo "STAGING_DOMAIN=${STAGING_DOMAIN}" >> "${EDGE_ENV}"
fi
chmod 600 "${EDGE_ENV}"

echo "Staging domain: https://${STAGING_DOMAIN}"
echo "Next:"
echo "  ./deploy/scripts/init-staging-dbs.sh"
echo "  ./deploy/scripts/deploy-staging.sh <IMAGE_TAG>"
