const APP_SLUG = "virgo"

const IDENTITY_SIGN_IN_URL =
  import.meta.env.VITE_CLERK_SIGN_IN_URL ?? "https://identity.sdee3.com/sign-in"

export function buildIdentitySignInUrl(redirectUrl?: string): string {
  const params = new URLSearchParams({
    app: APP_SLUG,
    redirect_url:
      redirectUrl ??
      `${window.location.origin}${window.location.pathname}${window.location.search}`,
  })
  return `${IDENTITY_SIGN_IN_URL}?${params.toString()}`
}
