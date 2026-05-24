import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const readingDoc = v.object({
  _id: v.id("readings"),
  _creationTime: v.number(),
  cardName: v.string(),
  summary: v.string(),
  drawnAt: v.number(),
})

export const saveReading = mutation({
  args: {
    deviceId: v.string(),
    cardName: v.string(),
    summary: v.string(),
    drawnAt: v.number(),
  },
  returns: v.id("readings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("readings", {
      deviceId: args.deviceId,
      cardName: args.cardName,
      summary: args.summary,
      drawnAt: args.drawnAt,
    })
  },
})

export const listReadings = query({
  args: {
    deviceId: v.string(),
    limit: v.number(),
    skip: v.optional(v.number()),
  },
  returns: v.object({
    readings: v.array(readingDoc),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, { deviceId, limit, skip = 0 }) => {
    const all = await ctx.db
      .query("readings")
      .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
      .order("desc")
      .collect()

    const readings = all.slice(skip, skip + limit).map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      cardName: row.cardName,
      summary: row.summary,
      drawnAt: row.drawnAt,
    }))
    const hasMore = all.length > skip + limit

    return { readings, hasMore }
  },
})
