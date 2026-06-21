const SUMMARY_CREDIT_COST = 800;

/** Debits apply only when CREDITS_ENFORCEMENT is exactly "true". Unset or "false" skips debits. */
export function isCreditsEnforcementEnabled(): boolean {
  return process.env.CREDITS_ENFORCEMENT === "true";
}

type ServiceCreditResult = {
  ledgerEntryId: string;
  balanceAfter: number;
  duplicate: boolean;
};

function refundIdempotencyKey(debitIdempotencyKey: string): string {
  return `${debitIdempotencyKey}:refund`;
}

async function callCreditsService(
  path: "debit" | "refund",
  body: Record<string, unknown>,
): Promise<ServiceCreditResult> {
  const siteUrl = process.env.IDENTITY_CONVEX_SITE_URL;
  const serviceSecret = process.env.CREDITS_SERVICE_SECRET;

  if (!siteUrl || !serviceSecret) {
    throw new Error("Credits service is not configured");
  }

  const response = await fetch(`${siteUrl}/api/credits/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      errorBody.error ?? `Credits ${path} failed (${response.status})`,
    );
  }

  return (await response.json()) as ServiceCreditResult;
}

export async function debitCreditsForUser(args: {
  clerkUserId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceCreditResult> {
  return await callCreditsService("debit", {
    clerkUserId: args.clerkUserId,
    amount: args.amount,
    appSlug: "virgo",
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
    metadata: args.metadata,
  });
}

export async function refundCreditsForUser(args: {
  clerkUserId: string;
  amount: number;
  reason: string;
  debitIdempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceCreditResult> {
  return await callCreditsService("refund", {
    clerkUserId: args.clerkUserId,
    amount: args.amount,
    appSlug: "virgo",
    reason: args.reason,
    idempotencyKey: refundIdempotencyKey(args.debitIdempotencyKey),
    metadata: {
      ...args.metadata,
      originalDebitKey: args.debitIdempotencyKey,
    },
  });
}

export async function refundSummaryDebit(args: {
  clerkUserId: string;
  amount: number;
  creditReason: string;
  debitIdempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isCreditsEnforcementEnabled()) {
    return;
  }

  try {
    await refundCreditsForUser({
      clerkUserId: args.clerkUserId,
      amount: args.amount,
      reason: `${args.creditReason}.refund`,
      debitIdempotencyKey: args.debitIdempotencyKey,
      metadata: args.metadata,
    });
  } catch (error) {
    console.error("Failed to refund credits after summary failure:", error);
  }
}

export { SUMMARY_CREDIT_COST };
