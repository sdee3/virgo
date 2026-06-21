import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider, useAuth } from "@clerk/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"
import App from "./App"
import { IdentityProvider, identityEnabled } from "./lib/identityContext"
import {
  identityApi,
  IdentityConvexAuthSync,
  identityConvex,
  identityCreditsEnabled,
  IdentityUserReadyProvider,
} from "./lib/identitySetup"
import "./App.css"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined

const convex =
  identityEnabled && convexUrl ? new ConvexReactClient(convexUrl) : null

function Root() {
  const app = (
    <IdentityProvider>
      <App />
    </IdentityProvider>
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

const app = <Root />

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {identityEnabled && convex && publishableKey ? (
      <ClerkProvider
        publishableKey={publishableKey}
        allowedRedirectOrigins={[
          "https://identity.sdee3.com",
          "https://virgo.sdee3.com",
          "http://localhost:3000",
          "http://localhost:5173",
        ]}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {identityCreditsEnabled ? (
            <IdentityConvexAuthSync identityConvex={identityConvex} />
          ) : null}
          {app}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    ) : (
      app
    )}
  </StrictMode>,
)
