import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createIdentityCreditsClient,
  type IdentityCreditsClient,
} from "./client";
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
  const client = useMemo(
    () => createIdentityCreditsClient({ identityConvexUrl, fetchAccessToken }),
    [identityConvexUrl, fetchAccessToken],
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
} {
  const client = useIdentityCreditsClient();
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setBalance(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = client.convex.watchQuery(
      identityCreditsApi.getBalance,
      {},
      (result) => {
        if (cancelled) return;
        if (result.type === "success") {
          setBalance(result.value.balance);
          setIsLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  return { balance, isLoading };
}
