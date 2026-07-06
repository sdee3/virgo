import { describe, expect, it, vi } from "vitest"
import { getClerkUserIdOrNull } from "./auth"

describe("getClerkUserIdOrNull", () => {
  it("returns null when auth identity lookup throws", async () => {
    const ctx = {
      auth: {
        getUserIdentity: vi.fn(async () => {
          throw new Error("Could not parse JWT payload")
        }),
      },
    }

    await expect(getClerkUserIdOrNull(ctx as never)).resolves.toBeNull()
  })

  it("returns the subject when auth succeeds", async () => {
    const ctx = {
      auth: {
        getUserIdentity: vi.fn(async () => ({ subject: "user_123" })),
      },
    }

    await expect(getClerkUserIdOrNull(ctx as never)).resolves.toBe("user_123")
  })
})
