import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

async function countRecentEntries(
  ctx: any,
  indexName:
    | "by_clerkUser_timestamp"
    | "by_device_timestamp"
    | "by_ipAddress_timestamp",
  fieldName: "clerkUserId" | "deviceId" | "ipAddress",
  fieldValue: string,
  cutoff: number,
) {
  return await ctx.db
    .query("rateLimits")
    .withIndex(indexName, (q: any) =>
      q.eq(fieldName, fieldValue).gte("timestamp", cutoff),
    )
    .collect()
}

export const checkAndRecordRateLimit = internalMutation({
  args: {
    deviceId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { deviceId, clerkUserId, ipAddress }) => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS

    if (ipAddress) {
      const recentEntries = await countRecentEntries(
        ctx,
        "by_ipAddress_timestamp",
        "ipAddress",
        ipAddress,
        cutoff,
      )

      if (recentEntries.length >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 }
      }
    }

    if (clerkUserId) {
      const recentEntries = await countRecentEntries(
        ctx,
        "by_clerkUser_timestamp",
        "clerkUserId",
        clerkUserId,
        cutoff,
      )

      if (recentEntries.length >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 }
      }

      await ctx.db.insert("rateLimits", {
        clerkUserId,
        ipAddress,
        timestamp: Date.now(),
      })

      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - recentEntries.length - 1,
      }
    }

    if (!deviceId) {
      throw new Error("deviceId or clerkUserId is required")
    }

    const recentEntries = await countRecentEntries(
      ctx,
      "by_device_timestamp",
      "deviceId",
      deviceId,
      cutoff,
    )

    if (recentEntries.length >= RATE_LIMIT_MAX) {
      return { allowed: false, remaining: 0 }
    }

    await ctx.db.insert("rateLimits", {
      deviceId,
      ipAddress,
      timestamp: Date.now(),
    })

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - recentEntries.length - 1,
    }
  },
})
