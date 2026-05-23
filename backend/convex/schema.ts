import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rateLimits: defineTable({
    deviceId: v.string(),
    timestamp: v.number(),
  }).index("by_device_timestamp", ["deviceId", "timestamp"]),
  readings: defineTable({
    deviceId: v.string(),
    cardName: v.string(),
    summary: v.string(),
    createdAt: v.number(),
  }).index("by_device_created", ["deviceId", "createdAt"]),
})
