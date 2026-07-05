#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

SECURITY_HEADERS_POLICY_NAME="${SECURITY_HEADERS_POLICY_NAME:-virgo-security-headers-${DISTRIBUTION_ID}}"
SECURITY_HEADERS_FUNCTION_NAME="${SECURITY_HEADERS_FUNCTION_NAME:-virgo-security-headers}"
MANAGED_SECURITY_HEADERS_POLICY_ID="67f7725c-6f97-4210-82d7-5512b31e9d03"
VIEWER_RESPONSE_FUNCTION_TEMPLATE="${SCRIPT_DIR}/cloudfront/virgo-viewer-response.js"
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

update_distribution_config() {
  local distribution_config_file="$1"
  local distribution_etag

  distribution_etag="$(aws cloudfront get-distribution-config \
    --id "${DISTRIBUTION_ID}" \
    --query "ETag" \
    --output text)"

  aws cloudfront update-distribution \
    --id "${DISTRIBUTION_ID}" \
    --if-match "${distribution_etag}" \
    --distribution-config "file://${distribution_config_file}" >/dev/null
}

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

apply_distribution_security_config() {
  local distribution_config_file="$1"
  local policy_id="$2"
  local viewer_response_function_arn="${3:-}"

  python3 - "${distribution_config_file}" "${policy_id}" "${viewer_response_function_arn}" <<'PY'
import json
import sys

config_path, policy_id, viewer_response_function_arn = sys.argv[1:4]

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

config["DefaultCacheBehavior"]["ResponseHeadersPolicyId"] = policy_id

for behavior in config.get("CacheBehaviors", {}).get("Items", []):
    behavior["ResponseHeadersPolicyId"] = policy_id

associations = config["DefaultCacheBehavior"].setdefault(
    "FunctionAssociations",
    {"Quantity": 0, "Items": []},
)
items = [
    item
    for item in associations.get("Items", [])
    if item.get("EventType") != "viewer-response"
]

if viewer_response_function_arn:
    items.append(
        {
            "FunctionARN": viewer_response_function_arn,
            "EventType": "viewer-response",
        }
    )

associations["Items"] = items
associations["Quantity"] = len(items)

with open(config_path, "w", encoding="utf-8") as handle:
    json.dump(config, handle)
PY
}

attach_response_headers_policy() {
  local policy_id="$1"
  local distribution_config_file
  local update_error_file
  local viewer_response_function_arn

  distribution_config_file="$(mktemp)"
  update_error_file="$(mktemp)"

  aws cloudfront get-distribution-config \
    --id "${DISTRIBUTION_ID}" \
    --query "DistributionConfig" > "${distribution_config_file}"

  apply_distribution_security_config "${distribution_config_file}" "${policy_id}" ""

  if update_distribution_config "${distribution_config_file}" 2>"${update_error_file}"; then
    rm -f "${distribution_config_file}" "${update_error_file}"
    return 0
  fi

  if grep -q "Free pricing plan" "${update_error_file}" \
    && grep -q "Custom response headers policy" "${update_error_file}"; then
    echo "CloudFront Free plan detected; using AWS managed SecurityHeadersPolicy plus viewer-response CSP."
    rm -f "${update_error_file}"

    viewer_response_function_arn="$(ensure_viewer_response_security_function)"

    aws cloudfront get-distribution-config \
      --id "${DISTRIBUTION_ID}" \
      --query "DistributionConfig" > "${distribution_config_file}"

    apply_distribution_security_config \
      "${distribution_config_file}" \
      "${MANAGED_SECURITY_HEADERS_POLICY_ID}" \
      "${viewer_response_function_arn}"

    update_distribution_config "${distribution_config_file}"
    rm -f "${distribution_config_file}"
    return 0
  fi

  cat "${update_error_file}" >&2
  rm -f "${distribution_config_file}" "${update_error_file}"
  return 1
}

ensure_viewer_response_security_function() {
  local function_code_file
  local function_arn
  local function_etag
  local describe_json

  if [[ ! -f "${VIEWER_RESPONSE_FUNCTION_TEMPLATE}" ]]; then
    echo "ERROR: Missing ${VIEWER_RESPONSE_FUNCTION_TEMPLATE}" >&2
    exit 1
  fi

  function_code_file="$(mktemp)"
  python3 - "${VIEWER_RESPONSE_FUNCTION_TEMPLATE}" "${function_code_file}" "${CONTENT_SECURITY_POLICY}" <<'PY'
import pathlib
import sys

template_path, output_path, csp = sys.argv[1:4]
template = pathlib.Path(template_path).read_text(encoding="utf-8")
escaped_csp = csp.replace("\\", "\\\\").replace("'", "\\'")
pathlib.Path(output_path).write_text(
    template.replace("__CONTENT_SECURITY_POLICY__", escaped_csp),
    encoding="utf-8",
)
PY

  if aws cloudfront describe-function --name "${SECURITY_HEADERS_FUNCTION_NAME}" >/dev/null 2>&1; then
    describe_json="$(aws cloudfront describe-function --name "${SECURITY_HEADERS_FUNCTION_NAME}")"
    function_etag="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['ETag'])" "${describe_json}")"
    function_arn="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['FunctionSummary']['FunctionMetadata']['FunctionARN'])" "${describe_json}")"

    update_json="$(aws cloudfront update-function \
      --name "${SECURITY_HEADERS_FUNCTION_NAME}" \
      --if-match "${function_etag}" \
      --function-config "Comment=Virgo viewer-response security headers,Runtime=cloudfront-js-2.0" \
      --function-code "fileb://${function_code_file}")"
    function_etag="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['ETag'])" "${update_json}")"
  else
    create_json="$(aws cloudfront create-function \
      --name "${SECURITY_HEADERS_FUNCTION_NAME}" \
      --function-config "Comment=Virgo viewer-response security headers,Runtime=cloudfront-js-2.0" \
      --function-code "fileb://${function_code_file}")"
    function_arn="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['FunctionSummary']['FunctionMetadata']['FunctionARN'])" "${create_json}")"
    function_etag="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['ETag'])" "${create_json}")"
  fi

  aws cloudfront publish-function \
    --name "${SECURITY_HEADERS_FUNCTION_NAME}" \
    --if-match "${function_etag}" >/dev/null

  rm -f "${function_code_file}"
  printf '%s' "${function_arn}"
}

configure_cloudfront_security_headers() {
  local custom_policy_id

  custom_policy_id="$(ensure_security_headers_policy)"
  attach_response_headers_policy "${custom_policy_id}"
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
