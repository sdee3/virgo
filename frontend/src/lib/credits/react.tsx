import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import {
  createIdentityCreditsClient,
  type IdentityCreditsClient,
} from "./client";
import { CREDIT_CATALOG_FALLBACK } from "./constants";
import type { CreditCatalog } from "./identityApi";
import { identityCreditsApi } from "./identityApi";

const IdentityCreditsContext = createContext<IdentityCreditsClient | null>(null);

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
      {children}
    </IdentityCreditsContext.Provider>
  );
}

export function useIdentityCreditsClient(): IdentityCreditsClient | null {
  return useContext(IdentityCreditsContext);
}

export function useCreditsBalance(): {
  balance: number | undefined;
  isLoading: boolean;
  error: string | null;
} {
  const { isSignedIn } = useAuth();
  const client = useIdentityCreditsClient();
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !isSignedIn) {
      setBalance(undefined);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const watch = client.convex.watchQuery(identityCreditsApi.getBalance, {});

    const applyResult = () => {
      if (cancelled) return;
      try {
        const result = watch.localQueryResult();
        if (result !== undefined) {
          setBalance(result.balance);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        setBalance(undefined);
        setIsLoading(false);
        setError(
          err instanceof Error ? err.message : "Failed to load balance",
        );
      }
    };

    const unsubscribe = watch.onUpdate(applyResult);
    applyResult();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, isSignedIn]);

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
