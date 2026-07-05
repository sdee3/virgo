import { beforeEach, describe, expect, it, vi } from "vitest"

const mockServer = vi.hoisted(() => ({
  mutation: vi.fn((definition: Record<string, unknown>) => ({
    kind: "mutation",
    ...definition,
  })),
  internalMutation: vi.fn((definition: Record<string, unknown>) => ({
    kind: "internalMutation",
    ...definition,
  })),
}))

vi.mock("./_generated/server", () => mockServer)

vi.mock("convex/values", () => ({
  v: new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  ),
}))

function createRateLimitDb(entriesByIndex: Record<string, number>) {
  const inserts: Array<Record<string, unknown>> = []

  return {
    db: {
      query(tableName: string) {
        if (tableName !== "rateLimits") {
          throw new Error(`Unexpected table: ${tableName}`)
        }

        let indexName = ""

        return {
          withIndex(
            name: string,
            callback: (query: {
              eq: (_field: string, _value: string) => { gte: (_field: string, _value: number) => unknown }
            }) => unknown,
          ) {
            indexName = name
            callback({
              eq: () => ({
                gte: () => ({}),
              }),
            })
            return this
          },
          collect() {
            return Array.from({ length: entriesByIndex[indexName] ?? 0 }, (_, id) => ({
              _id: `rate-${id}`,
            }))
          },
        }
      },
      insert(_tableName: string, value: Record<string, unknown>) {
        inserts.push(value)
      },
    },
    inserts,
  }
}

describe("summarize rate limiting hardening", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("internalizes the rate limit mutation", async () => {
    const module = await import("./summarize")

    expect((module.checkAndRecordRateLimit as any).kind).toBe("internalMutation")
  })

  it("applies rate limiting to forwarded IP addresses in addition to devices", async () => {
    const module = await import("./summarize")
    const context = createRateLimitDb({
      by_ipAddress_timestamp: 20,
      by_device_timestamp: 0,
      by_clerkUser_timestamp: 0,
    })

    const result = await (module.checkAndRecordRateLimit as any).handler(
      context as never,
      {
        deviceId: "device_123",
        ipAddress: "203.0.113.5",
      } as never,
    )

    expect(result).toEqual({ allowed: false, remaining: 0 })
    expect(context.inserts).toHaveLength(0)
  })
})
