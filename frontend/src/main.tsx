import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider } from "@clerk/react"
import { ConvexReactClient } from "convex/react"
import App from "./App"
import { AuthShell } from "./components/auth/AuthShell"
import { IdentityProvider } from "./lib/identityContext"
import { ConvexProviderWithClerkTemplate } from "./lib/convexClerkAuth"
import {
  identityApi,
  IdentityConvexAuthSync,
  identityConvex,
  identityCreditsEnabled,
  IdentityUserReadyProvider,
} from "./lib/identitySetup"
import "./App.css"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
const signInUrl = import.meta.env.VITE_CLERK_SIGN_IN_URL as string
const signUpUrl = import.meta.env.VITE_CLERK_SIGN_UP_URL as string

if (!convexUrl || !publishableKey || !signInUrl || !signUpUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL, VITE_CLERK_PUBLISHABLE_KEY, VITE_CLERK_SIGN_IN_URL, or VITE_CLERK_SIGN_UP_URL. Copy env vars into frontend/.env.local",
  )
}

const convex = new ConvexReactClient(convexUrl)

function Root() {
  const app = (
    <AuthShell>
      <IdentityProvider>
        <App />
      </IdentityProvider>
    </AuthShell>
  )

  if (!identityCreditsEnabled) {
    return app
  }

  return (
    <IdentityUserReadyProvider
      upsertFromClient={identityApi.users.upsertFromClient}
      identityConvex={identityConvex}
    >
      {app}
    </IdentityUserReadyProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      allowedRedirectOrigins={[
        "https://identity.sdee3.com",
        "https://virgo.sdee3.com",
        "https://winning-jaybird-28.accounts.dev",
        "http://localhost:3000",
        "http://localhost:5173",
      ]}
    >
      <ConvexProviderWithClerkTemplate client={convex}>
        {identityCreditsEnabled ? (
          <IdentityConvexAuthSync identityConvex={identityConvex} />
        ) : null}
        <Root />
      </ConvexProviderWithClerkTemplate>
    </ClerkProvider>
  </StrictMode>,
)
