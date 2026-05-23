import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const saveReading = mutation({
  args: {
    deviceId: v.string(),
    cardName: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { deviceId, cardName, summary }) => {
    await ctx.db.insert("readings", {
      deviceId,
      cardName,
      summary,
      createdAt: Date.now(),
    })
  },
})

export const listByDevice = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { deviceId, limit }) => {
    const max = limit ?? 20
    const rows = await ctx.db
      .query("readings")
      .withIndex("by_device_created", (q) => q.eq("deviceId", deviceId))
      .order("desc")
      .take(max)
    return rows.map(({ cardName, summary, createdAt }) => ({
      cardName,
      summary,
      createdAt,
    }))
  },
})
