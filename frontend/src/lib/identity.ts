const APP_SLUG = "virgo"

const IDENTITY_SIGN_IN_URL =
  import.meta.env.VITE_CLERK_SIGN_IN_URL ?? "https://identity.sdee3.com/sign-in"

function buildRedirectUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete("token")
  url.searchParams.delete("__clerk_ticket")
  return `${url.origin}${url.pathname}${url.search}${url.hash}`
}

export function buildIdentitySignInUrl(redirectUrl?: string): string {
  const params = new URLSearchParams({
    app: APP_SLUG,
    redirect_url: redirectUrl ?? buildRedirectUrl(),
  })
  return `${IDENTITY_SIGN_IN_URL}?${params.toString()}`
}
