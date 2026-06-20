import { useAuth, useUser } from "@clerk/react"
import { useMutation } from "convex/react"
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { identityApi } from "./identity-api"
import { IdentityConvexScope } from "./identityConvex"

const IdentityUserReadyContext = createContext(false)

export function useIdentityUserReady(): boolean {
  return useContext(IdentityUserReadyContext)
}

function IdentityUserSyncEffect({ onReady }: { onReady: () => void }) {
  const { isSignedIn, user } = useUser()
  const upsertFromClient = useMutation(identityApi.users.upsertFromClient)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isSignedIn || !user) {
      syncedFor.current = null
      return
    }

    if (syncedFor.current === user.id) {
      onReady()
      return
    }

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) {
      return
    }

    syncedFor.current = user.id
    void upsertFromClient({
      email,
      name: user.fullName ?? undefined,
      imageUrl: user.imageUrl,
    })
      .then(() => {
        onReady()
      })
      .catch(() => {
        syncedFor.current = null
      })
  }, [isSignedIn, user, upsertFromClient, onReady])

  return null
}

export function IdentityUserReadyProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isSignedIn) {
      setReady(false)
    }
  }, [isSignedIn])

  return (
    <IdentityUserReadyContext.Provider value={ready}>
      <IdentityConvexScope>
        <IdentityUserSyncEffect onReady={() => setReady(true)} />
      </IdentityConvexScope>
      {children}
    </IdentityUserReadyContext.Provider>
  )
}
