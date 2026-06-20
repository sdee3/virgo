import { ConvexReactClient } from "convex/react";
import type { CreditBalance, DebitCreditsArgs, DebitCreditsResult } from "./identityApi";
import { identityCreditsApi } from "./identityApi";

type FetchAccessToken = () => Promise<string | null>;

export type IdentityCreditsClient = {
  queryBalance: () => Promise<CreditBalance>;
  debit: (args: DebitCreditsArgs) => Promise<DebitCreditsResult>;
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
    debit: (args) => convex.mutation(identityCreditsApi.debit, args),
    convex,
  };
}
