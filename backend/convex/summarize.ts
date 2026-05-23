import { mutation } from "./_generated/server"
import { v } from "convex/values"

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

export const checkAndRecordRateLimit = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS

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
