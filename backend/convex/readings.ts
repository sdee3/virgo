import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireClerkUserId } from "./lib/auth"

type ReadingRow = {
  _id: Id<"readings">
  _creationTime: number
  cardName: string
  summary: string
  drawnAt: number
}

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
    clerkUserId: v.optional(v.string()),
    cardName: v.string(),
    summary: v.string(),
    drawnAt: v.number(),
    contextType: v.optional(
      v.union(v.literal("dating-match"), v.literal("daily-big-three")),
    ),
    sourceApp: v.optional(v.string()),
    targetProfileId: v.optional(v.string()),
  },
  returns: v.id("readings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("readings", {
      deviceId: args.deviceId,
      clerkUserId: args.clerkUserId,
      cardName: args.cardName,
      summary: args.summary,
      drawnAt: args.drawnAt,
      contextType: args.contextType,
      sourceApp: args.sourceApp,
      targetProfileId: args.targetProfileId,
    })
  },
})

export const getClerkUserIdByDevice = query({
  args: { deviceId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { deviceId }) => {
    const link = await ctx.db
      .query("deviceLinks")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique()
    return link?.clerkUserId ?? null
  },
})

export const listReadings = query({
  args: {
    deviceId: v.string(),
    clerkUserId: v.optional(v.string()),
    limit: v.number(),
    skip: v.optional(v.number()),
  },
  returns: v.object({
    readings: v.array(readingDoc),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, { deviceId, clerkUserId, limit, skip = 0 }) => {
    let all: ReadingRow[]

    if (clerkUserId) {
      const merged: ReadingRow[] = []
      const byUser: Doc<"readings">[] = await ctx.db
        .query("readings")
        .withIndex("by_clerkUserId_drawnAt", (q) =>
          q.eq("clerkUserId", clerkUserId),
        )
        .order("desc")
        .collect()

      const byDevice: Doc<"readings">[] = await ctx.db
        .query("readings")
        .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
        .order("desc")
        .collect()

      const seen = new Set<string>()
      for (const row of [...byUser, ...byDevice]) {
        if (seen.has(row._id)) continue
        seen.add(row._id)
        merged.push({
          _id: row._id,
          _creationTime: row._creationTime,
          cardName: row.cardName,
          summary: row.summary,
          drawnAt: row.drawnAt,
        })
      }

      merged.sort((a, b) => b.drawnAt - a.drawnAt)
      all = merged
    } else {
      const rows = await ctx.db
        .query("readings")
        .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
        .order("desc")
        .collect()

      all = rows.map((row) => ({
        _id: row._id,
        _creationTime: row._creationTime,
        cardName: row.cardName,
        summary: row.summary,
        drawnAt: row.drawnAt,
      }))
    }

    const readings = all.slice(skip, skip + limit)
    const hasMore = all.length > skip + limit

    return { readings, hasMore }
  },
})

export const linkDeviceToUser = mutation({
  args: { deviceId: v.string() },
  returns: v.object({ linkedCount: v.number() }),
  handler: async (ctx, { deviceId }) => {
    const clerkUserId = await requireClerkUserId(ctx)

    const existingLink = await ctx.db
      .query("deviceLinks")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique()

    if (existingLink && existingLink.clerkUserId !== clerkUserId) {
      throw new Error("This device is already linked to another account.")
    }

    if (!existingLink) {
      await ctx.db.insert("deviceLinks", {
        deviceId,
        clerkUserId,
        linkedAt: Date.now(),
      })
    }

    const readings = await ctx.db
      .query("readings")
      .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
      .collect()

    let linkedCount = 0
    for (const reading of readings) {
      if (reading.clerkUserId !== clerkUserId) {
        await ctx.db.patch(reading._id, { clerkUserId })
        linkedCount++
      }
    }

    return { linkedCount }
  },
})
