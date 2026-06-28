import { useAuth } from "@clerk/react"
import {
  readSignInTicket,
  stripSignInTicketFromUrl,
  useSignInTokenHandoff,
} from "@sdee3/credits"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { buildIdentitySignInUrl } from "../../lib/identitySetup"

function hasClerkDevBrowserJwt(): boolean {
  return new URLSearchParams(window.location.search).has("__clerk_db_jwt")
}

function AuthLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="auth-overlay">
      <p className="auth-overlay__message">{message}</p>
    </div>
  )
}

export function AuthShell({ children }: { children: ReactNode }) {
  const handoff = useSignInTokenHandoff()
  const { isLoaded, isSignedIn } = useAuth()
  const hasDbJwt = useMemo(() => hasClerkDevBrowserJwt(), [])
  const [devBrowserTimedOut, setDevBrowserTimedOut] = useState(false)

  useEffect(() => {
    if (!hasDbJwt || isSignedIn) {
      setDevBrowserTimedOut(false)
      return
    }
    if (!isLoaded) {
      return
    }

    const timeout = window.setTimeout(() => {
      if (!isSignedIn) {
        setDevBrowserTimedOut(true)
      }
    }, 15_000)

    return () => window.clearTimeout(timeout)
  }, [hasDbJwt, isLoaded, isSignedIn])

  if (handoff === "pending") {
    return <AuthLoading message="Signing you in…" />
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
            window.location.replace(buildIdentitySignInUrl())
          }}
        >
          Sign in again
        </button>
      </div>
    )
  }

  if (hasDbJwt && !devBrowserTimedOut && (!isLoaded || !isSignedIn)) {
    return <AuthLoading message="Signing you in…" />
  }

  if (hasDbJwt && devBrowserTimedOut && !isSignedIn) {
    return (
      <div className="auth-overlay">
        <p className="auth-overlay__message">
          Could not finish signing in. Try again from the identity hub.
        </p>
        <button
          type="button"
          className="auth-overlay__btn"
          onClick={() => {
            window.location.replace(buildIdentitySignInUrl())
          }}
        >
          Sign in again
        </button>
      </div>
    )
  }

  if (readSignInTicket() && !isSignedIn) {
    return <AuthLoading message="Signing you in…" />
  }

  return children
}
