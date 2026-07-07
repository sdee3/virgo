import { beforeEach, describe, expect, it, vi } from "vitest"

type TestReading = {
  _id: string
  _creationTime: number
  cardName: string
  summary: string
  drawnAt: number
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

function createPaginatedDb(datasets: {
  user: Record<string, TestReading[]>
  device: Record<string, TestReading[]>
}) {
  return {
    query(tableName: string) {
      if (tableName !== "readings") {
        throw new Error(`Unexpected table: ${tableName}`)
      }

      let indexName = ""
      let keyValue = ""

      return {
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
        collect() {
          throw new Error("collect should not be used for listReadings pagination")
        },
        paginate({
          cursor,
          numItems,
        }: {
          cursor: string | null
          numItems: number
        }) {
          const source =
            indexName === "by_clerkUserId_drawnAt"
              ? datasets.user[keyValue] ?? []
              : datasets.device[keyValue] ?? []
          const start = cursor ? Number(cursor) : 0
          const page = source.slice(start, start + numItems)
          const next = start + page.length
          return {
            page,
            continueCursor: next < source.length ? String(next) : null,
            isDone: next >= source.length,
          }
        },
      }
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

  it("pages signed-in readings by clerkUserId without collecting the entire history", async () => {
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

    const result = await (module.listReadings as any).handler(
      {
        db: createPaginatedDb({
          user: { user_123: userRows },
          device: { device_123: deviceRows },
        }),
      } as never,
      {
        deviceId: "device_123",
        clerkUserId: "user_123",
        limit: 2,
        skip: 1,
      },
    )

    expect(result).toEqual({
      readings: [
        {
          _id: "shared-7",
          _creationTime: 7,
          cardName: "The Magician",
          summary: "shared",
          drawnAt: 7,
        },
        {
          _id: "u-3",
          _creationTime: 3,
          cardName: "The Hermit",
          summary: "u3",
          drawnAt: 3,
        },
      ],
      hasMore: false,
    })
  })
})
