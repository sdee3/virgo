import type { CreditCatalog } from "../identity-api";

/** Credits deducted per tarot reading in Virgo. */
export const VIRGO_READING_CREDIT_COST = 800;

/** Shown when the Identity catalog query is unavailable. */
export const CREDIT_CATALOG_FALLBACK: CreditCatalog = {
  packs: [
    {
      key: "pack_7500",
      kind: "one_time",
      credits: 7500,
      priceUsd: 10,
      label: "7,500 credits",
      description: "One-time purchase",
    },
  ],
  subscriptions: [
    {
      key: "sub_5000",
      kind: "subscription",
      credits: 5000,
      priceUsd: 8,
      label: "5,000 credits / month",
      description: "Monthly subscription",
    },
    {
      key: "sub_20000",
      kind: "subscription",
      credits: 20000,
      priceUsd: 20,
      label: "20,000 credits / month",
      description: "Monthly subscription",
    },
  ],
  actionCosts: {
    virgo_tarot_draw: VIRGO_READING_CREDIT_COST,
    debates_llm_response: 200,
  },
};
