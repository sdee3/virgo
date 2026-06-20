import { ConvexReactClient } from "convex/react";
import type { PaginationOptions, PaginationResult } from "convex/server";
import type {
  CheckoutSessionResult,
  BillingPortalResult,
  CreditBalance,
  CreditCatalog,
  CreditLedgerEntry,
  CreditPriceKey,
  DebitCreditsArgs,
  DebitCreditsResult,
} from "./identityApi";
import { identityCreditsApi } from "./identityApi";

type FetchAccessToken = () => Promise<string | null>;

export type IdentityCreditsClient = {
  queryBalance: () => Promise<CreditBalance>;
  queryCatalog: () => Promise<CreditCatalog>;
  queryLedger: (
    paginationOpts: PaginationOptions,
  ) => Promise<PaginationResult<CreditLedgerEntry>>;
  debit: (args: DebitCreditsArgs) => Promise<DebitCreditsResult>;
  createCheckoutSession: (args: {
    priceKey: CreditPriceKey;
    successUrl: string;
    cancelUrl: string;
  }) => Promise<CheckoutSessionResult>;
  createBillingPortalSession: (args: {
    returnUrl: string;
  }) => Promise<BillingPortalResult>;
  convex: ConvexReactClient;
};

export function createIdentityCreditsClient(options: {
  identityConvexUrl: string;
  fetchAccessToken: FetchAccessToken;
}): IdentityCreditsClient {
  const convex = new ConvexReactClient(options.identityConvexUrl);

  convex.setAuth(async () => {
    const token = await options.fetchAccessToken();
    return token ?? null;
  });

  return {
    queryBalance: () => convex.query(identityCreditsApi.getBalance, {}),
    queryCatalog: () => convex.query(identityCreditsApi.getCatalog, {}),
    queryLedger: (paginationOpts) =>
      convex.query(identityCreditsApi.listLedger, { paginationOpts }),
    debit: (args) => convex.mutation(identityCreditsApi.debit, args),
    createCheckoutSession: (args) =>
      convex.action(identityCreditsApi.createCheckoutSession, args),
    createBillingPortalSession: (args) =>
      convex.action(identityCreditsApi.createBillingPortalSession, args),
    convex,
  };
}
