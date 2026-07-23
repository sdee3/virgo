#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"

source "${SCRIPT_DIR}/.env"

# Resolve dist path from repo root so the script works from any cwd.
if [[ -z "${DIST_DIR:-}" ]]; then
  DIST_DIR="${FRONTEND_DIR}/dist"
elif [[ "${DIST_DIR}" != /* ]]; then
  DIST_DIR="${REPO_ROOT}/${DIST_DIR#./}"
fi
# shellcheck source=../../identity/shared/clerk-csp.sh
source "${SCRIPT_DIR}/../../identity/shared/clerk-csp.sh"

SECURITY_HEADERS_POLICY_NAME="${SECURITY_HEADERS_POLICY_NAME:-virgo-security-headers-${DISTRIBUTION_ID}}"
SECURITY_HEADERS_FUNCTION_NAME="${SECURITY_HEADERS_FUNCTION_NAME:-virgo-security-headers}"
SECURITY_HEADERS_POLICY_COMMENT="Security headers for the Virgo frontend"
SECURITY_HEADERS_FUNCTION_COMMENT="Virgo viewer-response security headers"
VIEWER_RESPONSE_FUNCTION_TEMPLATE="${SCRIPT_DIR}/cloudfront/virgo-viewer-response.js"
CONTENT_SECURITY_POLICY="${CONTENT_SECURITY_POLICY:-${SDEE3_CLERK_CONTENT_SECURITY_POLICY}}"
# shellcheck source=../../identity/scripts/lib/cloudfront-security-headers.sh
source "${SCRIPT_DIR}/../../identity/scripts/lib/cloudfront-security-headers.sh"

FORCE_ASSETS=false
for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE_ASSETS=true
      ;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$0") [--force]

Deploy the frontend build to S3 and invalidate CloudFront.

  --force  Sync the full tarot card deck under /cards (delete orphans and
           upload changes). Skipped by default to avoid costly S3 operations.
           Card chrome such as tarot-rear-bg.jpg is always uploaded.
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Run $(basename "$0") --help for usage." >&2
      exit 1
      ;;
  esac
done

SYNC_EXCLUDES=(
  --exclude ".DS_Store"
  --exclude "*/.DS_Store"
)

CARD_EXCLUDES=(
  --exclude "cards/*"
  --exclude "cards/2x/*"
)

# Lightweight non-deck assets under /cards that must ship with every deploy
# (the flip animation rear image, etc.). Full webp deck sync stays behind --force.
CARD_CHROME_INCLUDES=(
  --exclude "*"
  --include "*.jpg"
  --include "*.jpeg"
  --include "*.png"
)

write_production_env() {
  local env_file="${SCRIPT_DIR}/../frontend/.env.production"

  cat > "${env_file}" <<EOF
VITE_CONVEX_URL=${VITE_CONVEX_URL:-https://moonlit-ibex-457.convex.cloud}
VITE_CONVEX_SITE_URL=${VITE_CONVEX_SITE_URL:-https://moonlit-ibex-457.convex.site}
VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsuc2RlZTMuY29tJA}
VITE_CLERK_SIGN_IN_URL=${VITE_CLERK_SIGN_IN_URL:-https://identity.sdee3.com/sign-in}
VITE_CLERK_SIGN_UP_URL=${VITE_CLERK_SIGN_UP_URL:-https://identity.sdee3.com/sign-up}
VITE_IDENTITY_CONVEX_URL=${VITE_IDENTITY_CONVEX_URL:-https://glad-snake-999.convex.cloud}
EOF
}


echo "=== Building frontend (production env from frontend/.env.production) ==="
write_production_env
pnpm --dir "${FRONTEND_DIR}" build --mode production

echo ""
echo "=== Uploading long-lived static files (excluding card images) ==="
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" \
  --delete \
  --region "${REGION}" \
  "${SYNC_EXCLUDES[@]}" \
  "${CARD_EXCLUDES[@]}" \
  --exclude "assets/*" \
  --exclude "index.html" \
  --exclude "sw.js" \
  --exclude "registerSW.js" \
  --exclude "manifest.webmanifest" \
  --exclude "build-id.txt" \
  --exclude "workbox-*.js" \
  --cache-control "public, max-age=31536000, immutable"

if [[ -d "${DIST_DIR}/assets" ]]; then
  aws s3 cp "${DIST_DIR}/assets" "s3://${BUCKET}/assets" \
    --recursive \
    --region "${REGION}" \
    --cache-control "public, max-age=31536000, immutable"
fi

SHELL_CACHE_CONTROL="no-cache, must-revalidate"
for shell_file in sw.js registerSW.js manifest.webmanifest build-id.txt; do
  if [[ -f "${DIST_DIR}/${shell_file}" ]]; then
    aws s3 cp "${DIST_DIR}/${shell_file}" "s3://${BUCKET}/${shell_file}" \
      --region "${REGION}" \
      --cache-control "${SHELL_CACHE_CONTROL}"
  fi
done

for workbox_file in "${DIST_DIR}"/workbox-*.js; do
  if [[ -f "${workbox_file}" ]]; then
    aws s3 cp "${workbox_file}" "s3://${BUCKET}/$(basename "${workbox_file}")" \
      --region "${REGION}" \
      --cache-control "${SHELL_CACHE_CONTROL}"
  fi
done

echo ""
echo "=== Uploading index.html (no edge cache) ==="
aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --region "${REGION}" \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate"

echo ""
echo "=== Uploading card chrome assets (backs / non-deck images) ==="
if [[ -d "${DIST_DIR}/cards" ]]; then
  aws s3 sync "${DIST_DIR}/cards" "s3://${BUCKET}/cards" \
    "${CARD_CHROME_INCLUDES[@]}" \
    "${SYNC_EXCLUDES[@]}" \
    --region "${REGION}" \
    --cache-control "public, max-age=31536000, immutable"
else
  echo "Warning: ${DIST_DIR}/cards is missing; skipping card chrome upload." >&2
fi

if [[ "${FORCE_ASSETS}" == true ]]; then
  echo ""
  echo "=== Uploading full card deck (--force) ==="
  aws s3 sync "${DIST_DIR}/cards" "s3://${BUCKET}/cards" \
    --delete \
    "${SYNC_EXCLUDES[@]}" \
    --region "${REGION}"
else
  echo ""
  echo "=== Skipping full card deck sync (pass --force to sync all /cards) ==="
fi

echo ""
echo "=== Ensuring CloudFront security headers policy ==="
configure_cloudfront_security_headers

echo ""
echo "=== Invalidating CloudFront cache ==="
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --region "${REGION}" \
  --query "Invalidation.Id" \
  --output text)

echo "Invalidation created: ${INVALIDATION_ID}"
echo ""
echo "=== Deploy complete ==="
echo "HTML shell + SW: no-cache | /assets/*: immutable, max-age=31536000"
