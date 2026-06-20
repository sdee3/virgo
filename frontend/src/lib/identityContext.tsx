import { useAuth, useClerk, useUser } from "@clerk/react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useConvexAuth, useMutation } from "convex/react"
import { api } from "@convex-api"
import { getDeviceId } from "./deviceId"
import { buildIdentitySignInUrl } from "./identity"
import { setAuthTokenGetter } from "./authToken"

export const identityEnabled = Boolean(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
    import.meta.env.VITE_CONVEX_URL,
)

type HandoffState = "idle" | "pending" | "done" | "error"

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

const TICKET_PARAM_NAMES = ["token", "__clerk_ticket"] as const

function readSignInTicket(): string | null {
  const params = new URLSearchParams(window.location.search)
  for (const name of TICKET_PARAM_NAMES) {
    const value = params.get(name)
    if (value) return value
  }
  return null
}

function stripSignInTicketFromUrl(): void {
  const url = new URL(window.location.href)
  let changed = false
  for (const name of TICKET_PARAM_NAMES) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name)
      changed = true
    }
  }
  if (!changed) return
  const next = url.pathname + (url.search ? url.search : "") + url.hash
  window.history.replaceState({}, "", next)
}

function useSignInTokenHandoff(): HandoffState {
  const ticket = useMemo(() => readSignInTicket(), [])
  const clerk = useClerk()
  const { isLoaded, isSignedIn } = useAuth()
  const [state, setState] = useState<HandoffState>(() =>
    ticket ? "pending" : "idle",
  )
  const started = useRef(false)

  useEffect(() => {
    if (!ticket) {
      setState("idle")
      return
    }

    if (!isLoaded || !clerk.loaded) {
      return
    }

    if (isSignedIn) {
      stripSignInTicketFromUrl()
      setState("done")
      return
    }

    if (started.current) {
      return
    }
    started.current = true

    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (!cancelled) setState("error")
    }, 20_000)

    void (async () => {
      setState("pending")
      try {
        const signIn = clerk.client?.signIn
        if (!signIn) {
          setState("error")
          return
        }

        const attempt = await signIn.create({
          strategy: "ticket",
          ticket,
        })
        if (cancelled) return

        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          setState("error")
          return
        }

        await clerk.setActive({
          session: attempt.createdSessionId,
          navigate: async () => {
            stripSignInTicketFromUrl()
          },
        })
        if (cancelled) return

        stripSignInTicketFromUrl()
        setState("done")
      } catch {
        if (!cancelled) setState("error")
      } finally {
        window.clearTimeout(timeout)
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [ticket, isLoaded, clerk, isSignedIn])

  if (!ticket || state === "done") {
    return "idle"
  }
  return state
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
