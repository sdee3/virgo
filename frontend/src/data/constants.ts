const configuredConvexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL?.trim()

export const CONVEX_SITE_URL =
  configuredConvexSiteUrl || "https://tangible-impala-518.convex.site"
