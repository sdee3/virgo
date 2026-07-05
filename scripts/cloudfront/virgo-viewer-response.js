/**
 * Viewer-response function for Virgo on CloudFront Free plan distributions.
 * Adds CSP and X-Frame-Options that managed response header policies cannot customize.
 *
 * CONTENT_SECURITY_POLICY is substituted by deploy-frontend.sh at deploy time.
 */
function handler(event) {
  var response = event.response;
  var headers = response.headers;

  headers["content-security-policy"] = {
    value: "__CONTENT_SECURITY_POLICY__",
  };
  headers["x-frame-options"] = { value: "DENY" };

  return response;
}
