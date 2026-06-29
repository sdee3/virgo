import type { CreditCatalog } from "@sdee3/credits";

/** Credits deducted per tarot reading in Virgo. */
export const VIRGO_READING_CREDIT_COST = 200;

/** Shown when the Identity catalog query is unavailable. */
export const CREDIT_CATALOG_FALLBACK: CreditCatalog = {
  packs: [
    {
      key: "pack_spark",
      kind: "one_time",
      credits: 5000,
      priceUsd: 6,
      label: "Spark",
      description: "5,000 credits · one-time purchase",
    },
    {
      key: "pack_ember",
      kind: "one_time",
      credits: 12000,
      priceUsd: 12,
      label: "Ember",
      description: "12,000 credits · one-time purchase",
    },
    {
      key: "pack_fire",
      kind: "one_time",
      credits: 25000,
      priceUsd: 20,
      label: "Fire",
      description: "25,000 credits · one-time purchase",
    },
  ],
  actionCosts: {
    virgo_tarot_draw: VIRGO_READING_CREDIT_COST,
    debates_llm_response: 200,
    astro_mate_custom_synastry: 350,
  },
};
