/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_CONVEX_SITE_URL: string
  readonly VITE_IDENTITY_CONVEX_URL?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_CLERK_SIGN_IN_URL: string
  readonly VITE_CLERK_SIGN_UP_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_ID__: string

declare module "@convex-api" {
  export { api } from "../../backend/convex/_generated/api"
}
