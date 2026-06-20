import type { FunctionReference } from "convex/server";

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
};

export function buildIdempotencyKey(
  appSlug: AppSlug,
  action: string,
  uniqueId: string,
): string {
  return `${appSlug}:${action}:${uniqueId}`;
}
