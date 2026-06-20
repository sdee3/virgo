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
