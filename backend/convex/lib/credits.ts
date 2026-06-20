const SUMMARY_CREDIT_COST = 500;

/** Debits apply only when CREDITS_ENFORCEMENT is exactly "true". Unset or "false" skips debits. */
export function isCreditsEnforcementEnabled(): boolean {
  return process.env.CREDITS_ENFORCEMENT === "true";
}

type ServiceDebitResult = {
  ledgerEntryId: string;
  balanceAfter: number;
  duplicate: boolean;
};

export async function debitCreditsForUser(args: {
  clerkUserId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceDebitResult> {
  const siteUrl = process.env.IDENTITY_CONVEX_SITE_URL;
  const serviceSecret = process.env.CREDITS_SERVICE_SECRET;

  if (!siteUrl || !serviceSecret) {
    throw new Error("Credits service is not configured");
  }

  const response = await fetch(`${siteUrl}/api/credits/debit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clerkUserId: args.clerkUserId,
      amount: args.amount,
      appSlug: "virgo",
      reason: args.reason,
      idempotencyKey: args.idempotencyKey,
      metadata: args.metadata,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Credits debit failed (${response.status})`);
  }

  return (await response.json()) as ServiceDebitResult;
}

export { SUMMARY_CREDIT_COST };
