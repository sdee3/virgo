import {
  createContext,
  useCallback,
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
import type { CreditCatalog, CreditLedgerEntry } from "./identityApi";
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

export function useCreditsCatalog(): {
  catalog: CreditCatalog | undefined;
  isLoading: boolean;
} {
  const client = useIdentityCreditsClient();
  const [catalog, setCatalog] = useState<CreditCatalog | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setCatalog(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = client.convex.watchQuery(
      identityCreditsApi.getCatalog,
      {},
      (result) => {
        if (cancelled) return;
        if (result.type === "success") {
          setCatalog(result.value);
          setIsLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  return { catalog, isLoading };
}

const LEDGER_PAGE_SIZE = 20;

export function useCreditsLedger(): {
  entries: CreditLedgerEntry[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
} {
  const client = useIdentityCreditsClient();
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    if (!client) {
      setEntries([]);
      setHasMore(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = client.convex.watchQuery(
      identityCreditsApi.listLedger,
      { paginationOpts: { numItems: LEDGER_PAGE_SIZE, cursor: null } },
      (result) => {
        if (cancelled || result.type !== "success") return;
        setEntries(result.value.page);
        setHasMore(!result.value.isDone);
        setCursor(result.value.continueCursor);
        setIsLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  const loadMore = useCallback(async () => {
    if (!client || !hasMore || cursor === null) return;
    setIsLoading(true);
    try {
      const result = await client.queryLedger({
        numItems: LEDGER_PAGE_SIZE,
        cursor,
      });
      setEntries((prev) => [...prev, ...result.page]);
      setHasMore(!result.isDone);
      setCursor(result.continueCursor);
    } finally {
      setIsLoading(false);
    }
  }, [client, cursor, hasMore]);

  return { entries, isLoading, hasMore, loadMore };
}
