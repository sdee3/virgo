#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"
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

  --force  Sync card images (delete orphans and upload changes).
           Skipped by default to avoid costly S3 operations.
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

write_production_env() {
  local env_file="${SCRIPT_DIR}/../frontend/.env.production"

  cat > "${env_file}" <<EOF
VITE_CONVEX_URL=${VITE_CONVEX_URL:-https://tangible-impala-518.convex.cloud}
VITE_CONVEX_SITE_URL=${VITE_CONVEX_SITE_URL:-https://tangible-impala-518.convex.site}
VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsuc2RlZTMuY29tJA}
VITE_CLERK_SIGN_IN_URL=${VITE_CLERK_SIGN_IN_URL:-https://identity.sdee3.com/sign-in}
VITE_CLERK_SIGN_UP_URL=${VITE_CLERK_SIGN_UP_URL:-https://identity.sdee3.com/sign-up}
VITE_IDENTITY_CONVEX_URL=${VITE_IDENTITY_CONVEX_URL:-https://glad-snake-999.convex.cloud}
EOF
}


echo "=== Building frontend (production env from frontend/.env.production) ==="
write_production_env
pnpm --dir ./frontend build --mode production

echo ""
echo "=== Uploading dist/ to s3://${BUCKET} (excluding card images) ==="
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" \
  --delete \
  "${SYNC_EXCLUDES[@]}" \
  "${CARD_EXCLUDES[@]}" \
  --region "${REGION}"

if [[ "${FORCE_ASSETS}" == true ]]; then
  echo ""
  echo "=== Uploading card images (--force) ==="
  aws s3 sync "${DIST_DIR}/cards" "s3://${BUCKET}/cards" \
    --delete \
    "${SYNC_EXCLUDES[@]}" \
    --region "${REGION}"
else
  echo ""
  echo "=== Skipping card images (pass --force to sync) ==="
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
