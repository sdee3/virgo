import type { FunctionReference } from "convex/server";
import type { PaginationOptions, PaginationResult } from "convex/server";

export type AppSlug = "virgo" | "portfolio" | "astro-mate" | "debates";

export type CreditBalance = {
  balance: number;
  userId: string | null;
};

export type DebitCreditsArgs = {
  amount: number;
  appSlug: AppSlug;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type DebitCreditsResult = {
  ledgerEntryId: string;
  balanceAfter: number;
  duplicate: boolean;
};

export type CreditPriceKey = "pack_7500" | "sub_5000" | "sub_20000";

export type CreditPack = {
  key: CreditPriceKey;
  kind: "one_time" | "subscription";
  credits: number;
  priceUsd: number;
  label: string;
  description: string;
};

export type CreditCatalog = {
  packs: CreditPack[];
  subscriptions: CreditPack[];
  actionCosts: {
    virgo_tarot_draw: number;
    debates_llm_response: number;
  };
};

export type CreditTransactionType =
  | "grant"
  | "debit"
  | "refund"
  | "adjustment";

export type CreditLedgerEntry = {
  _id: string;
  _creationTime: number;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: CreditTransactionType;
  appSlug?: AppSlug;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

export type CheckoutSessionResult = {
  url: string;
  sessionId: string;
};

export type BillingPortalResult = {
  url: string;
};

export const identityCreditsApi = {
  getBalance: "credits/queries:getBalance" as FunctionReference<
    "query",
    "public",
    Record<string, never>,
    CreditBalance
  >,
  debit: "credits/mutations:debit" as FunctionReference<
    "mutation",
    "public",
    DebitCreditsArgs,
    DebitCreditsResult
  >,
  getCatalog: "credits/products:getCatalog" as FunctionReference<
    "query",
    "public",
    Record<string, never>,
    CreditCatalog
  >,
  listLedger: "credits/queries:listLedger" as FunctionReference<
    "query",
    "public",
    { paginationOpts: PaginationOptions },
    PaginationResult<CreditLedgerEntry>
  >,
  createCheckoutSession: "credits/stripeCheckout:createCheckoutSession" as FunctionReference<
    "action",
    "public",
    {
      priceKey: CreditPriceKey;
      successUrl: string;
      cancelUrl: string;
    },
    CheckoutSessionResult
  >,
  createBillingPortalSession:
    "credits/stripeCheckout:createBillingPortalSession" as FunctionReference<
      "action",
      "public",
      { returnUrl: string },
      BillingPortalResult
    >,
};

export function buildIdempotencyKey(
  appSlug: AppSlug,
  action: string,
  uniqueId: string,
): string {
  return `${appSlug}:${action}:${uniqueId}`;
}
