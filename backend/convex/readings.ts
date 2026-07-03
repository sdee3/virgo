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
}

const readingDoc = v.object({
  _id: v.id("readings"),
  _creationTime: v.number(),
  cardName: v.string(),
  summary: v.string(),
  drawnAt: v.number(),
})

const PAGINATION_CHUNK_SIZE = 25

type ReadingsQuery = {
  paginate: (args: {
    cursor: string | null
    numItems: number
  }) => Promise<{
    page: Doc<"readings">[]
    continueCursor: string | null
    isDone: boolean
  }>
}

function toReadingRow(row: Doc<"readings">): ReadingRow {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    cardName: row.cardName,
    summary: row.summary,
    drawnAt: row.drawnAt,
  }
}

async function collectSingleStreamPage(args: {
  query: ReadingsQuery
  skip: number
  limit: number
}): Promise<{ readings: ReadingRow[]; hasMore: boolean }> {
  const targetCount = args.skip + args.limit + 1
  const rows: Doc<"readings">[] = []
  let cursor: string | null = null
  let isDone = false

  while (rows.length < targetCount && !isDone) {
    const batch = await args.query.paginate({
      cursor,
      numItems: Math.max(PAGINATION_CHUNK_SIZE, targetCount - rows.length),
    })
    rows.push(...batch.page)
    cursor = batch.continueCursor
    isDone = batch.isDone
  }

  return {
    readings: rows.slice(args.skip, args.skip + args.limit).map(toReadingRow),
    hasMore: rows.length > args.skip + args.limit || !isDone,
  }
}

async function collectMergedStreamsPage(args: {
  userQuery: ReadingsQuery
  deviceQuery: ReadingsQuery
  skip: number
  limit: number
}): Promise<{ readings: ReadingRow[]; hasMore: boolean }> {
  const targetCount = args.skip + args.limit + 1
  const merged: ReadingRow[] = []
  const seen = new Set<string>()

  let userCursor: string | null = null
  let deviceCursor: string | null = null
  let userDone = false
  let deviceDone = false
  let userBuffer: Doc<"readings">[] = []
  let deviceBuffer: Doc<"readings">[] = []

  while (
    merged.length < targetCount &&
    (!userDone || userBuffer.length > 0 || !deviceDone || deviceBuffer.length > 0)
  ) {
    if (userBuffer.length === 0 && !userDone) {
      const batch = await args.userQuery.paginate({
        cursor: userCursor,
        numItems: PAGINATION_CHUNK_SIZE,
      })
      userBuffer = batch.page
      userCursor = batch.continueCursor
      userDone = batch.isDone
    }

    if (deviceBuffer.length === 0 && !deviceDone) {
      const batch = await args.deviceQuery.paginate({
        cursor: deviceCursor,
        numItems: PAGINATION_CHUNK_SIZE,
      })
      deviceBuffer = batch.page
      deviceCursor = batch.continueCursor
      deviceDone = batch.isDone
    }

    const nextUser = userBuffer[0]
    const nextDevice = deviceBuffer[0]

    if (!nextUser && !nextDevice) {
      break
    }

    const useUser =
      nextUser &&
      (!nextDevice || nextUser.drawnAt >= nextDevice.drawnAt)

    const nextRow = useUser ? userBuffer.shift() : deviceBuffer.shift()
    if (!nextRow) {
      continue
    }

    const rowId = String(nextRow._id)
    if (seen.has(rowId)) {
      continue
    }

    seen.add(rowId)
    merged.push(toReadingRow(nextRow))
  }

  return {
    readings: merged.slice(args.skip, args.skip + args.limit),
    hasMore:
      merged.length > args.skip + args.limit ||
      !userDone ||
      userBuffer.length > 0 ||
      !deviceDone ||
      deviceBuffer.length > 0,
  }
}

export const saveReading = internalMutation({
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
  }),
  handler: async (ctx, { deviceId, clerkUserId, limit, skip = 0 }) => {
    if (clerkUserId) {
      return await collectMergedStreamsPage({
        userQuery: ctx.db
        .query("readings")
        .withIndex("by_clerkUserId_drawnAt", (q) =>
          q.eq("clerkUserId", clerkUserId),
        )
        .order("desc"),
        deviceQuery: ctx.db
        .query("readings")
        .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
        .order("desc")
        ,
        skip,
        limit,
      })
    }

    return await collectSingleStreamPage({
      query: ctx.db
        .query("readings")
        .withIndex("by_device_drawnAt", (q) => q.eq("deviceId", deviceId))
        .order("desc"),
      skip,
      limit,
    })
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
