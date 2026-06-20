import { useAuth, useUser } from "@clerk/react";
import { ConvexProvider, useMutation } from "convex/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createIdentityCreditsClient,
  type IdentityCreditsClient,
} from "./client";
import { CREDIT_CATALOG_FALLBACK } from "./constants";
import type { CreditCatalog } from "./identityApi";
import { identityCreditsApi, identityUsersApi } from "./identityApi";

const IdentityCreditsContext = createContext<IdentityCreditsClient | null>(null);
const IdentityUserReadyContext = createContext(false);

function IdentityConvexScope({ children }: { children: ReactNode }) {
  const client = useContext(IdentityCreditsContext);
  if (!client) {
    return children;
  }
  return <ConvexProvider client={client.convex}>{children}</ConvexProvider>;
}

function IdentityUserSyncEffect({ onReady }: { onReady: () => void }) {
  const { isSignedIn, user } = useUser();
  const upsertFromClient = useMutation(identityUsersApi.upsertFromClient);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) {
      syncedFor.current = null;
      return;
    }

    if (syncedFor.current === user.id) {
      onReady();
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      return;
    }

    syncedFor.current = user.id;
    void upsertFromClient({
      email,
      name: user.fullName ?? undefined,
      imageUrl: user.imageUrl,
    })
      .then(() => {
        onReady();
      })
      .catch(() => {
        syncedFor.current = null;
      });
  }, [isSignedIn, user, upsertFromClient, onReady]);

  return null;
}

function IdentityUserReadyProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setReady(false);
    }
  }, [isSignedIn]);

  return (
    <IdentityUserReadyContext.Provider value={ready}>
      <IdentityConvexScope>
        <IdentityUserSyncEffect onReady={() => setReady(true)} />
      </IdentityConvexScope>
      {children}
    </IdentityUserReadyContext.Provider>
  );
}

export function IdentityCreditsProvider({
  children,
  identityConvexUrl,
  fetchAccessToken,
}: {
  children: ReactNode;
  identityConvexUrl: string;
  fetchAccessToken: () => Promise<string | null>;
}) {
  const fetchAccessTokenRef = useRef(fetchAccessToken);
  fetchAccessTokenRef.current = fetchAccessToken;

  const client = useMemo(
    () =>
      createIdentityCreditsClient({
        identityConvexUrl,
        fetchAccessToken: () => fetchAccessTokenRef.current(),
      }),
    [identityConvexUrl],
  );

  return (
    <IdentityCreditsContext.Provider value={client}>
      <IdentityUserReadyProvider>{children}</IdentityUserReadyProvider>
    </IdentityCreditsContext.Provider>
  );
}

export function useIdentityCreditsClient(): IdentityCreditsClient | null {
  return useContext(IdentityCreditsContext);
}

function useIdentityUserReady(): boolean {
  return useContext(IdentityUserReadyContext);
}

export function useCreditsBalance(): {
  balance: number | undefined;
  isLoading: boolean;
  error: string | null;
} {
  const { isSignedIn } = useAuth();
  const client = useIdentityCreditsClient();
  const identityReady = useIdentityUserReady();
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !isSignedIn || !identityReady) {
      setBalance(undefined);
      setError(null);
      setIsLoading(!isSignedIn ? false : Boolean(client) && !identityReady);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const unsubscribe = client.convex.watchQuery(
      identityCreditsApi.getBalance,
      {},
      (result) => {
        if (cancelled) return;
        if (result.type === "success") {
          setBalance(result.value.balance);
          setIsLoading(false);
          setError(null);
        } else if (result.type === "error") {
          setBalance(undefined);
          setIsLoading(false);
          setError(result.error.message);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, isSignedIn, identityReady]);

  return { balance, isLoading, error };
}

export function useCreditsCatalog(): {
  catalog: CreditCatalog;
} {
  const client = useIdentityCreditsClient();
  const [catalog, setCatalog] = useState<CreditCatalog>(CREDIT_CATALOG_FALLBACK);

  useEffect(() => {
    if (!client) return;

    void client
      .queryCatalog()
      .then(setCatalog)
      .catch(() => {
        // Keep the local fallback catalog.
      });
  }, [client]);

  return { catalog };
}
