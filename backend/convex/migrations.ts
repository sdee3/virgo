import { internalMutation } from "./_generated/server"

/** Removes documents from the pre-deviceId schema (ip / userKey / createdAt). */
export const purgeLegacyDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    let rateLimitsRemoved = 0
    let readingsRemoved = 0

    for (const doc of await ctx.db.query("rateLimits").collect()) {
      if (!("deviceId" in doc) || doc.deviceId === undefined) {
        await ctx.db.delete(doc._id)
        rateLimitsRemoved++
      }
    }

    for (const doc of await ctx.db.query("readings").collect()) {
      const hasDeviceId = "deviceId" in doc && doc.deviceId !== undefined
      const hasDrawnAt = "drawnAt" in doc && doc.drawnAt !== undefined
      if (!hasDeviceId || !hasDrawnAt) {
        await ctx.db.delete(doc._id)
        readingsRemoved++
      }
    }

    return { rateLimitsRemoved, readingsRemoved }
  },
})
