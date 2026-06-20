#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

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

echo "=== Building frontend ==="
pnpm --dir ./frontend build

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
