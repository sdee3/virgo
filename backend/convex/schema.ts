import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rateLimits: defineTable({
    ip: v.string(),
    timestamp: v.number(),
  }).index("by_ip_timestamp", ["ip", "timestamp"]),
})
