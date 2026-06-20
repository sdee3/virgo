import { makeFunctionReference } from "convex/server"
import type { FunctionReference } from "convex/server"

export type CreditBalance = {
  balance: number
  userId: string | null
}

export type CreditPriceKey = "pack_7500" | "sub_5000" | "sub_20000"

export type CreditPack = {
  key: CreditPriceKey
  kind: "one_time" | "subscription"
  credits: number
  priceUsd: number
  label: string
  description: string
}

export type CreditCatalog = {
  packs: CreditPack[]
  subscriptions: CreditPack[]
  actionCosts: {
    virgo_tarot_draw: number
    debates_llm_response: number
  }
}

export type CreditLedgerEntry = {
  _id: string
  _creationTime: number
  amount: number
  balanceAfter: number
  type: "grant" | "debit" | "refund" | "adjustment"
  appSlug?: "virgo" | "portfolio" | "astro-mate" | "debates"
  reason: string
  createdAt: number
}

export type PaginatedLedger = {
  page: CreditLedgerEntry[]
  isDone: boolean
  continueCursor: string | null
}

export const identityApi = {
  users: {
    upsertFromClient: makeFunctionReference<
      "mutation",
      {
        email: string
        name?: string
        imageUrl?: string
      },
      string
    >("users:upsertFromClient"),
  },
  credits: {
    queries: {
      getBalance: makeFunctionReference<
        "query",
        Record<string, never>,
        CreditBalance
      >("credits/queries:getBalance"),
      listLedger: makeFunctionReference<
        "query",
        { paginationOpts: { numItems: number; cursor: string | null } },
        PaginatedLedger
      >("credits/queries:listLedger"),
    },
    products: {
      getCatalog: makeFunctionReference<
        "query",
        Record<string, never>,
        CreditCatalog
      >("credits/products:getCatalog"),
    },
    stripeCheckout: {
      createCheckoutSession: makeFunctionReference<
        "action",
        {
          priceKey: CreditPriceKey
          successUrl: string
          cancelUrl: string
        },
        { url: string; sessionId: string }
      >("credits/stripeCheckout:createCheckoutSession"),
      createBillingPortalSession: makeFunctionReference<
        "action",
        { returnUrl: string },
        { url: string }
      >("credits/stripeCheckout:createBillingPortalSession"),
    },
  },
} as const satisfies {
  users: {
    upsertFromClient: FunctionReference<
      "mutation",
      "public",
      {
        email: string
        name?: string
        imageUrl?: string
      },
      string
    >
  }
  credits: {
    queries: {
      getBalance: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        CreditBalance
      >
      listLedger: FunctionReference<
        "query",
        "public",
        { paginationOpts: { numItems: number; cursor: string | null } },
        PaginatedLedger
      >
    }
    products: {
      getCatalog: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        CreditCatalog
      >
    }
    stripeCheckout: {
      createCheckoutSession: FunctionReference<
        "action",
        "public",
        {
          priceKey: CreditPriceKey
          successUrl: string
          cancelUrl: string
        },
        { url: string; sessionId: string }
      >
      createBillingPortalSession: FunctionReference<
        "action",
        "public",
        { returnUrl: string },
        { url: string }
      >
    }
  }
}
