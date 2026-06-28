import { useAuth } from "@clerk/react"
import type { ReactNode } from "react"
import { useCallback, useMemo } from "react"
import { ConvexProviderWithAuth } from "convex/react"
import type { ConvexReactClient } from "convex/react"

/**
 * Like ConvexProviderWithClerk, but always mints the "convex" JWT template.
 * Clerk's Convex integration sets sessionClaims.aud === "convex", which makes
 * the stock provider send a session token that omits custom template claims
 * (e.g. email). This app needs those claims for backend auth.
 */
export function ConvexProviderWithClerkTemplate({
  client,
  children,
}: {
  client: ConvexReactClient
  children: ReactNode
}) {
  const useAuthForConvex = useUseClerkConvexAuth()
  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  )
}

function useUseClerkConvexAuth() {
  return useMemo(
    () =>
      function useClerkConvexAuth() {
        const { isLoaded, isSignedIn, getToken } = useAuth()
        const fetchAccessToken = useCallback(
          async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
            try {
              return await getToken({
                template: "convex",
                skipCache: forceRefreshToken,
              })
            } catch {
              return null
            }
          },
          [getToken],
        )
        return useMemo(
          () => ({
            isLoading: !isLoaded,
            isAuthenticated: isSignedIn ?? false,
            fetchAccessToken,
          }),
          [isLoaded, isSignedIn, fetchAccessToken],
        )
      },
    [],
  )
}
