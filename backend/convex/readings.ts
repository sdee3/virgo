import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireClerkUserId } from "./lib/auth"

type ReadingRow = {
  _id: Id<"readings">
  _creationTime: number
  cardName: string
  summary: string
  drawnAt: number
  contextType?:
    | "dating-match"
    | "dating-potential-match"
    | "daily-big-three"
}

const readingDoc = v.object({
  _id: v.id("readings"),
  _creationTime: v.number(),
  cardName: v.string(),
  summary: v.string(),
  drawnAt: v.number(),
  contextType: v.optional(
    v.union(
      v.literal("dating-match"),
      v.literal("dating-potential-match"),
      v.literal("daily-big-three"),
    ),
  ),
})

const PAGINATION_CHUNK_SIZE = 25

function toReadingRow(row: Doc<"readings">): ReadingRow {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    cardName: row.cardName,
    summary: row.summary,
    drawnAt: row.drawnAt,
    contextType: row.contextType,
  }
}

// ponytail: exact `total` requires scanning the user's whole stream once (kept
// in memory). Fine for personal tarot histories; if they ever grow huge, move
// the count into its own internalQuery (one paginated query per function).
async function collectSingleStream(args: {
  query: {
    paginate: (args: {
      cursor: string | null
      numItems: number
    }) => Promise<{
      page: Doc<"readings">[]
      continueCursor: string | null
      isDone: boolean
    }>
  }
}): Promise<Doc<"readings">[]> {
  const rows: Doc<"readings">[] = []
  let cursor: string | null = null
  let isDone = false

  while (!isDone) {
    const batch = await args.query.paginate({
      cursor,
      numItems: PAGINATION_CHUNK_SIZE,
    })
    rows.push(...batch.page)
    cursor = batch.continueCursor
    isDone = batch.isDone
  }

  return rows
}

export const saveReading = internalMutation({
  args: {
    deviceId: v.string(),
    clerkUserId: v.optional(v.string()),
    cardName: v.string(),
    summary: v.string(),
    drawnAt: v.number(),
    contextType: v.optional(
      v.union(
        v.literal("dating-match"),
        v.literal("dating-potential-match"),
        v.literal("daily-big-three"),
      ),
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

export const getClerkUserIdByDevice = internalQuery({
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

export const listReadings = internalQuery({
  args: {
    deviceId: v.string(),
    clerkUserId: v.optional(v.string()),
    limit: v.number(),
    skip: v.optional(v.number()),
  },
  returns: v.object({
    readings: v.array(readingDoc),
    hasMore: v.boolean(),
    total: v.number(),
  }),
  handler: async (ctx, { deviceId, clerkUserId, limit, skip = 0 }) => {
    // Signed-in users: query by clerkUserId only; device readings are stamped
    // or linked on sign-in. Convex allows ONE paginated query per function, so
    // page the whole stream once, then slice the requested window from it.
    const indexName = clerkUserId
      ? "by_clerkUserId_drawnAt"
      : "by_device_drawnAt"
    const key = clerkUserId ?? deviceId

    const rows = await collectSingleStream({
      query: ctx.db
        .query("readings")
        .withIndex(indexName, (q) =>
          clerkUserId ? q.eq("clerkUserId", key) : q.eq("deviceId", key),
        )
        .order("desc"),
    })

    return {
      readings: rows.slice(skip, skip + limit).map(toReadingRow),
      hasMore: rows.length > skip + limit,
      total: rows.length,
    }
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
