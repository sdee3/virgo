import { useAuth, useClerk, useUser } from "@clerk/react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { useConvexAuth, useMutation } from "convex/react"
import {
  stripSignInTicketFromUrl,
  useSignInTokenHandoff,
} from "@sdee3/credits"
import { api } from "@convex-api"
import { getDeviceId } from "./deviceId"
import { buildIdentitySignInUrl } from "./identitySetup"
import { setAuthTokenGetter } from "./authToken"

export const identityEnabled = Boolean(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
    import.meta.env.VITE_CONVEX_URL,
)

type IdentityContextValue = {
  enabled: boolean
  isLoaded: boolean
  isSignedIn: boolean
  userLabel: string | null
  signIn: () => void
  signOut: () => Promise<void>
}

const disabledValue: IdentityContextValue = {
  enabled: false,
  isLoaded: true,
  isSignedIn: false,
  userLabel: null,
  signIn: () => {
    window.location.href = buildIdentitySignInUrl()
  },
  signOut: async () => {},
}

const IdentityContext = createContext<IdentityContextValue>(disabledValue)

export function useIdentity(): IdentityContextValue {
  return useContext(IdentityContext)
}

function IdentityProviderInner({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const { isAuthenticated } = useConvexAuth()
  const handoff = useSignInTokenHandoff()
  const linkDevice = useMutation(api.readings.linkDeviceToUser)
  const linked = useRef(false)

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null
      return getToken({ template: "convex" })
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
        window.location.href = buildIdentitySignInUrl()
      },
      signOut: async () => {
        await clerk.signOut()
      },
    }),
    [isLoaded, isSignedIn, user, clerk],
  )

  if (handoff === "pending") {
    return (
      <div className="auth-overlay">
        <p className="auth-overlay__message">Signing you in…</p>
      </div>
    )
  }

  if (handoff === "error") {
    return (
      <div className="auth-overlay">
        <p className="auth-overlay__message">Sign-in link expired or invalid.</p>
        <button
          type="button"
          className="auth-overlay__btn"
          onClick={() => {
            stripSignInTicketFromUrl()
            window.location.href = buildIdentitySignInUrl()
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  )
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  if (!identityEnabled) {
    return (
      <IdentityContext.Provider value={disabledValue}>
        {children}
      </IdentityContext.Provider>
    )
  }

  return <IdentityProviderInner>{children}</IdentityProviderInner>
}
