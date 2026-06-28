import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server"
import { api } from "../_generated/api"

type AuthCtx = QueryCtx | MutationCtx | ActionCtx

export async function getClerkUserIdOrNull(
  ctx: AuthCtx,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

/** JWT first; fall back to a linked device when the HTTP client omits Authorization. */
export async function resolveClerkUserIdForRequest(
  ctx: ActionCtx,
  deviceId: string | null,
): Promise<string | null> {
  const fromAuth = await getClerkUserIdOrNull(ctx)
  if (fromAuth) {
    return fromAuth
  }
  if (!deviceId) {
    return null
  }
  return await ctx.runQuery(api.readings.getClerkUserIdByDevice, { deviceId })
}

export async function requireClerkUserId(ctx: AuthCtx): Promise<string> {
  const clerkUserId = await getClerkUserIdOrNull(ctx)
  if (!clerkUserId) {
    throw new Error("Not authenticated")
  }
  return clerkUserId
}
