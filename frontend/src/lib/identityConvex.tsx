import { useAuth } from "@clerk/react"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { useEffect, type ReactNode } from "react"

const identityConvexUrl = import.meta.env.VITE_IDENTITY_CONVEX_URL as
  | string
  | undefined

export const identityCreditsEnabled = Boolean(identityConvexUrl)

export const identityConvex = identityConvexUrl
  ? new ConvexReactClient(identityConvexUrl)
  : null

export function IdentityConvexAuthSync() {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    if (!identityConvex) return

    if (!isSignedIn) {
      identityConvex.clearAuth()
      return
    }

    identityConvex.setAuth(async () => {
      return (await getToken({ template: "convex" })) ?? null
    })
  }, [getToken, isSignedIn])

  return null
}

export function IdentityConvexScope({ children }: { children: ReactNode }) {
  if (!identityConvex) {
    return children
  }

  return (
    <ConvexProvider client={identityConvex}>{children}</ConvexProvider>
  )
}
