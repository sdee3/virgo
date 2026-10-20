import { beforeEach, describe, expect, it, vi } from "vitest"

type TestReading = {
  _id: string
  _creationTime: number
  cardName: string
  summary: string
  drawnAt: number
  contextType?: string
}

const mockServer = vi.hoisted(() => ({
  query: vi.fn((definition: Record<string, unknown>) => ({
    kind: "query",
    ...definition,
  })),
  mutation: vi.fn((definition: Record<string, unknown>) => ({
    kind: "mutation",
    ...definition,
  })),
  internalQuery: vi.fn((definition: Record<string, unknown>) => ({
    kind: "internalQuery",
    ...definition,
  })),
  internalMutation: vi.fn((definition: Record<string, unknown>) => ({
    kind: "internalMutation",
    ...definition,
  })),
}))

vi.mock("./_generated/server", () => mockServer)

vi.mock("./lib/auth", () => ({
  requireClerkUserId: vi.fn(async () => "user_123"),
}))

vi.mock("convex/values", () => ({
  v: new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  ),
}))

function createReadingsDb(datasets: {
  user: Record<string, TestReading[]>
  device: Record<string, TestReading[]>
  deviceLinks?: Record<string, string>
}) {
  return {
    query(tableName: string) {
      let indexName = ""
      let keyValue = ""

      const query = {
        withIndex(name: string, callback: (query: { eq: (_field: string, value: string) => unknown }) => unknown) {
          indexName = name
          callback({
            eq: (_field, value) => {
              keyValue = value
              return {}
            },
          })
          return this
        },
        order() {
          return this
        },
        unique() {
          if (tableName !== "deviceLinks") {
            throw new Error(`Unexpected unique query: ${tableName}`)
          }
          const clerkUserId = datasets.deviceLinks?.[keyValue]
          return clerkUserId ? { clerkUserId } : null
        },
        paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
          if (tableName !== "readings") {
            throw new Error(`Unexpected paginate query: ${tableName}`)
          }
          const rows = indexName === "by_clerkUserId_drawnAt"
            ? datasets.user[keyValue] ?? []
            : datasets.device[keyValue] ?? []
          const start = cursor ? Number(cursor) : 0
          const end = Math.min(start + numItems, rows.length)
          return {
            page: rows.slice(start, end),
            isDone: end >= rows.length,
            continueCursor: String(end),
          }
        },
      }
      return query
    },
  }
}

describe("readings security hardening", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("internalizes storage and lookup functions while keeping device linking public", async () => {
    const module = await import("./readings")

    expect((module.saveReading as any).kind).toBe("internalMutation")
    expect((module.listReadings as any).kind).toBe("internalQuery")
    expect((module.getClerkUserIdByDevice as any).kind).toBe("internalQuery")
    expect((module.linkDeviceToUser as any).kind).toBe("mutation")
  })

  it("pages signed-in readings by clerkUserId and ignores device-only rows", async () => {
    const module = await import("./readings")

    const userRows: TestReading[] = [
      {
        _id: "u-9",
        _creationTime: 9,
        cardName: "The Fool",
        summary: "u9",
        drawnAt: 9,
      },
      {
        _id: "shared-7",
        _creationTime: 7,
        cardName: "The Magician",
        summary: "shared",
        drawnAt: 7,
        contextType: "dating-potential-match",
      },
      {
        _id: "u-3",
        _creationTime: 3,
        cardName: "The Hermit",
        summary: "u3",
        drawnAt: 3,
      },
    ]
    const deviceRows: TestReading[] = [
      {
        _id: "d-8",
        _creationTime: 8,
        cardName: "The Star",
        summary: "d8",
        drawnAt: 8,
      },
      {
        _id: "shared-7",
        _creationTime: 7,
        cardName: "The Magician",
        summary: "shared",
        drawnAt: 7,
      },
      {
        _id: "d-5",
        _creationTime: 5,
        cardName: "Strength",
        summary: "d5",
        drawnAt: 5,
      },
      {
        _id: "d-1",
        _creationTime: 1,
        cardName: "The World",
        summary: "d1",
        drawnAt: 1,
      },
    ]

    const db = createReadingsDb({
      user: { user_123: userRows },
      device: { device_123: deviceRows },
    })
    const firstPage = await (module.listReadings as any).handler(
      {
        db,
      } as never,
      {
        deviceId: "device_123",
        clerkUserId: "user_123",
        paginationOpts: { numItems: 2, cursor: null },
      },
    )

    expect(firstPage).toEqual({
      deviceLinkConflict: false,
      readings: [
        {
          _id: "u-9",
          _creationTime: 9,
          cardName: "The Fool",
          summary: "u9",
          drawnAt: 9,
        },
        {
          _id: "shared-7",
          _creationTime: 7,
          cardName: "The Magician",
          summary: "shared",
          drawnAt: 7,
          contextType: "dating-potential-match",
        },
      ],
      hasMore: true,
      continueCursor: "2",
    })

    const secondPage = await (module.listReadings as any).handler(
      { db } as never,
      {
        deviceId: "device_123",
        clerkUserId: "user_123",
        paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
      },
    )
    expect(secondPage.readings.map((row: TestReading) => row._id)).toEqual(["u-3"])
    expect(secondPage.hasMore).toBe(false)
  })

  it("rejects a linked device before it reads the history", async () => {
    const module = await import("./readings")
    const db = createReadingsDb({
      user: {},
      device: {},
      deviceLinks: { device_123: "user_999" },
    })

    const result = await (module.listReadings as any).handler(
      { db } as never,
      {
        deviceId: "device_123",
        clerkUserId: "user_123",
        paginationOpts: { numItems: 20, cursor: null },
      },
    )

    expect(result).toEqual({ deviceLinkConflict: true })
  })
})
