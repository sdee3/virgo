import { useAuth, useUser } from "@clerk/react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { useConvexAuth, useMutation } from "convex/react"
import { api } from "@convex-api"
import { getDeviceId } from "./deviceId"
import { buildIdentitySignInUrl } from "./identitySetup"
import { setAuthTokenGetter } from "./authToken"

export const identityEnabled = true

type IdentityContextValue = {
  enabled: boolean
  isLoaded: boolean
  isSignedIn: boolean
  userLabel: string | null
  signIn: () => void
  signOut: () => Promise<void>
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

export function useIdentity(): IdentityContextValue {
  const value = useContext(IdentityContext)
  if (!value) {
    throw new Error("useIdentity must be used within IdentityProvider")
  }
  return value
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth()
  const { user } = useUser()
  const { isAuthenticated } = useConvexAuth()
  const linkDevice = useMutation(api.readings.linkDeviceToUser)
  const linked = useRef(false)

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null
      try {
        return await getToken({ template: "convex" })
      } catch {
        return null
      }
    })
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (!isAuthenticated || linked.current) return
    linked.current = true
    void linkDevice({ deviceId: getDeviceId() }).catch(() => {
      linked.current = false
    })
  }, [isAuthenticated, linkDevice])

  const value = useMemo<IdentityContextValue>(
    () => ({
      enabled: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userLabel:
        user?.primaryEmailAddress?.emailAddress ??
        user?.fullName ??
        user?.username ??
        null,
      signIn: () => {
        window.location.replace(buildIdentitySignInUrl())
      },
      signOut: async () => {
        await signOut({ redirectUrl: buildIdentitySignInUrl() })
      },
    }),
    [isLoaded, isSignedIn, user, signOut],
  )

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  )
}
