import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rateLimits: defineTable({
    deviceId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_device_timestamp", ["deviceId", "timestamp"])
    .index("by_clerkUser_timestamp", ["clerkUserId", "timestamp"])
    .index("by_ipAddress_timestamp", ["ipAddress", "timestamp"]),
  readings: defineTable({
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
  })
    .index("by_device_drawnAt", ["deviceId", "drawnAt"])
    .index("by_clerkUserId_drawnAt", ["clerkUserId", "drawnAt"]),
  deviceLinks: defineTable({
    deviceId: v.string(),
    clerkUserId: v.string(),
    linkedAt: v.number(),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_clerkUserId", ["clerkUserId"]),
})
