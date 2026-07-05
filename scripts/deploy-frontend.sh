#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

SECURITY_HEADERS_POLICY_NAME="${SECURITY_HEADERS_POLICY_NAME:-virgo-security-headers-${DISTRIBUTION_ID}}"
CONTENT_SECURITY_POLICY="${CONTENT_SECURITY_POLICY:-default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests}"

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

ensure_security_headers_policy() {
  local policy_file
  local policy_id
  local policy_etag

  policy_file="$(mktemp)"
  cat > "${policy_file}" <<EOF
{
  "Name": "${SECURITY_HEADERS_POLICY_NAME}",
  "Comment": "Security headers for the Virgo frontend",
  "SecurityHeadersConfig": {
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "${CONTENT_SECURITY_POLICY}"
    },
    "ContentTypeOptions": {
      "Override": true
    },
    "FrameOptions": {
      "FrameOption": "DENY",
      "Override": true
    },
    "ReferrerPolicy": {
      "ReferrerPolicy": "strict-origin-when-cross-origin",
      "Override": true
    },
    "StrictTransportSecurity": {
      "AccessControlMaxAgeSec": 63072000,
      "IncludeSubdomains": true,
      "Preload": true,
      "Override": true
    }
  }
}
EOF

  policy_id="$(aws cloudfront list-response-headers-policies \
    --type custom \
    --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='${SECURITY_HEADERS_POLICY_NAME}'].ResponseHeadersPolicy.Id | [0]" \
    --output text)"

  if [[ "${policy_id}" == "None" ]]; then
    policy_id="$(aws cloudfront create-response-headers-policy \
      --response-headers-policy-config "file://${policy_file}" \
      --query "ResponseHeadersPolicy.Id" \
      --output text)"
  else
    policy_etag="$(aws cloudfront get-response-headers-policy-config \
      --id "${policy_id}" \
      --query "ETag" \
      --output text)"
    aws cloudfront update-response-headers-policy \
      --id "${policy_id}" \
      --if-match "${policy_etag}" \
      --response-headers-policy-config "file://${policy_file}" >/dev/null
  fi

  rm -f "${policy_file}"
  printf '%s' "${policy_id}"
}

attach_security_headers_policy() {
  local policy_id="$1"
  local distribution_config_file
  local distribution_etag

  distribution_config_file="$(mktemp)"
  distribution_etag="$(aws cloudfront get-distribution-config \
    --id "${DISTRIBUTION_ID}" \
    --query "ETag" \
    --output text)"

  aws cloudfront get-distribution-config \
    --id "${DISTRIBUTION_ID}" \
    --query "DistributionConfig" > "${distribution_config_file}"

  python - "${distribution_config_file}" "${policy_id}" <<'PY'
import json
import sys

config_path = sys.argv[1]
policy_id = sys.argv[2]

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

config["DefaultCacheBehavior"]["ResponseHeadersPolicyId"] = policy_id

for behavior in config.get("CacheBehaviors", {}).get("Items", []):
    behavior["ResponseHeadersPolicyId"] = policy_id

with open(config_path, "w", encoding="utf-8") as handle:
    json.dump(config, handle)
PY

  aws cloudfront update-distribution \
    --id "${DISTRIBUTION_ID}" \
    --if-match "${distribution_etag}" \
    --distribution-config "file://${distribution_config_file}" >/dev/null

  rm -f "${distribution_config_file}"
}

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
echo "=== Ensuring CloudFront security headers policy ==="
SECURITY_HEADERS_POLICY_ID="$(ensure_security_headers_policy)"
attach_security_headers_policy "${SECURITY_HEADERS_POLICY_ID}"

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
