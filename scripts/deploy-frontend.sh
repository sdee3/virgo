#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

echo "=== Building frontend ==="
pnpm --dir ./frontend build

echo ""
echo "=== Emptying S3 bucket: s3://${BUCKET} ==="
aws s3 rm "s3://${BUCKET}" --recursive --region "${REGION}"

echo ""
echo "=== Uploading dist/ to s3://${BUCKET} ==="
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" --delete --region "${REGION}"

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
