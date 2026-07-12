import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

/** Dev-only: remove all rows from deviceLinks (e.g. after switching test users on one browser). */
export const unlinkAllDeviceLinks = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const links = await ctx.db.query("deviceLinks").collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    return links.length
  },
})

/** Dev-only: remove device links owned by a Clerk user. */
export const unlinkDevicesByClerkUserId = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.number(),
  handler: async (ctx, { clerkUserId }) => {
    const links = await ctx.db
      .query("deviceLinks")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    return links.length
  },
})
