import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server"

type AuthCtx = QueryCtx | MutationCtx | ActionCtx

export async function getClerkUserIdOrNull(
  ctx: AuthCtx,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export async function requireClerkUserId(ctx: AuthCtx): Promise<string> {
  const clerkUserId = await getClerkUserIdOrNull(ctx)
  if (!clerkUserId) {
    throw new Error("Not authenticated")
  }
  return clerkUserId
}
