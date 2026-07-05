# Virgo production security checklist

Use this checklist before each production deploy.

## Access control

- [ ] Keep `REQUIRE_AUTH_FOR_SUMMARIZE=true` in production. Set it to `false` only for an intentional anonymous rollout.
- [ ] If `CREDITS_ENFORCEMENT=true`, verify Clerk auth is working end-to-end before release. Anonymous `/summarize` calls are blocked in this mode.
- [ ] Confirm `linkDeviceToUser` is the only public readings mutation and that device-link ownership checks still pass for signed-in users.

## Secrets and service configuration

- [ ] Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- [ ] Set `IDENTITY_CONVEX_SITE_URL`.
- [ ] Set `CREDITS_SERVICE_SECRET_VIRGO` (must match Identity `CREDITS_SERVICE_SECRET_VIRGO`).
- [ ] Do not rely on secret rotation being part of this checklist; track rotation separately.

## Network and origin controls

- [ ] Keep the Virgo frontend origin allowlist limited to the approved production and local development origins.
- [ ] Ensure CloudFront forwards `X-Forwarded-For` so IP-based rate limiting can run at the HTTP layer.
- [ ] Confirm disallowed origins receive `403` responses without `Access-Control-Allow-Origin`.

## CloudFront and browser protections

- [ ] Deploy with `scripts/deploy-frontend.sh` so the CloudFront response headers policy is created or updated automatically.
- [ ] Verify the distribution is serving:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`

## Validation

- [ ] Run `pnpm test` in `backend/`.
- [ ] Run `pnpm test` in `frontend/` if a frontend test script exists.
- [ ] Run `pnpm build` in `frontend/`.
- [ ] Smoke-test `/summarize`, `/readings`, and device linking with:
  - an authenticated user,
  - an anonymous device (only if anonymous summarize is intentionally enabled),
  - a mismatched linked-device scenario that should return `403`.
