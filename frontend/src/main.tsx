import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider, useAuth } from "@clerk/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"
import App from "./App"
import { IdentityProvider, identityEnabled } from "./lib/identityContext"
import "./App.css"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined

const convex =
  identityEnabled && convexUrl ? new ConvexReactClient(convexUrl) : null

function Root() {
  return (
    <IdentityProvider>
      <App />
    </IdentityProvider>
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
          "http://localhost:3000",
        ]}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {app}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    ) : (
      app
    )}
  </StrictMode>,
)
