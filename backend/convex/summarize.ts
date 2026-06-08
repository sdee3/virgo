import { mutation } from "./_generated/server"
import { v } from "convex/values"

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

export const checkAndRecordRateLimit = mutation({
  args: {
    deviceId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, { deviceId, clerkUserId }) => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS

    if (clerkUserId) {
      const recentEntries = await ctx.db
        .query("rateLimits")
        .withIndex("by_clerkUser_timestamp", (q) =>
          q.eq("clerkUserId", clerkUserId).gte("timestamp", cutoff),
        )
        .collect()

      if (recentEntries.length >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 }
      }

      await ctx.db.insert("rateLimits", {
        clerkUserId,
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

    const recentEntries = await ctx.db
      .query("rateLimits")
      .withIndex("by_device_timestamp", (q) =>
        q.eq("deviceId", deviceId).gte("timestamp", cutoff),
      )
      .collect()

    if (recentEntries.length >= RATE_LIMIT_MAX) {
      return { allowed: false, remaining: 0 }
    }

    await ctx.db.insert("rateLimits", { deviceId, timestamp: Date.now() })

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - recentEntries.length - 1,
    }
  },
})
