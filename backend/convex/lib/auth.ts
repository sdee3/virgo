import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server"

type AuthCtx = QueryCtx | MutationCtx | ActionCtx

export async function getClerkUserIdOrNull(
  ctx: AuthCtx,
): Promise<string | null> {
  try {
    const identity = await ctx.auth.getUserIdentity()
    return identity?.subject ?? null
  } catch {
    // Invalid or malformed Bearer tokens throw before our HTTP handler can
    // attach CORS headers, which mobile browsers surface as "Load failed".
    return null
  }
}

export async function requireClerkUserId(ctx: AuthCtx): Promise<string> {
  const clerkUserId = await getClerkUserIdOrNull(ctx)
  if (!clerkUserId) {
    throw new Error("Not authenticated")
  }
  return clerkUserId
}
