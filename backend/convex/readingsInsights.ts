import { ConvexError, v } from "convex/values"
import { query } from "./_generated/server"
import {
  countBy,
  last3CalendarDayKeys,
  summarizeLast3CalendarDays,
} from "./lib/insightsHelpers"

const dayMs = 86_400_000

function isSeedUserId(userId: string): boolean {
  return (
    userId.startsWith("seed:aaf:") ||
    userId.startsWith("seed:dating:") ||
    userId.startsWith("seed:demo:")
  )
}

function isAstroMateDraw(reading: {
  sourceApp?: string
  clerkUserId?: string
}): boolean {
  if (reading.sourceApp !== "astro-mate") {
    return false
  }
  if (!reading.clerkUserId) {
    return true
  }
  return !isSeedUserId(reading.clerkUserId)
}

export const getAstroMateDrawInsights = query({
  args: {
    secret: v.string(),
  },
  returns: v.object({
    draws: v.object({
      total: v.number(),
      byDay: v.array(
        v.object({
          dateKey: v.string(),
          count: v.number(),
        }),
      ),
      events: v.array(
        v.object({
          clerkUserId: v.union(v.string(), v.null()),
          dateKey: v.string(),
          at: v.number(),
          cardName: v.string(),
          contextType: v.string(),
          targetProfileId: v.union(v.string(), v.null()),
        }),
      ),
      rollingLast3d: v.number(),
      byContextType: v.record(v.string(), v.number()),
    }),
  }),
  handler: async (ctx, args) => {
    const expected = process.env.ASTRO_MATE_INSIGHTS_SECRET?.trim()
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Unauthorized")
    }

    const readings = await ctx.db.query("readings").collect()
    const now = Date.now()
    const astroMateDraws = readings.filter(isAstroMateDraw)
    const last3dDraws = summarizeLast3CalendarDays(
      astroMateDraws,
      (row) => row.drawnAt,
      (row, dateKey, at) => ({
        clerkUserId: row.clerkUserId ?? null,
        dateKey,
        at,
        cardName: row.cardName,
        contextType: row.contextType ?? "unknown",
        targetProfileId: row.targetProfileId ?? null,
      }),
      now,
    )
    const windowStart = now - 3 * dayMs
    const recentDraws = astroMateDraws.filter((row) => row.drawnAt >= windowStart)

    return {
      draws: {
        ...last3dDraws,
        rollingLast3d: recentDraws.length,
        byContextType: countBy(recentDraws, (row) => row.contextType ?? "unknown"),
      },
    }
  },
})