import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("credits service secret hardening", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    process.env.IDENTITY_CONVEX_SITE_URL = "https://identity.example"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("prefers the Virgo-specific service secret when present", async () => {
    process.env.CREDITS_SERVICE_SECRET = "generic-secret"
    process.env.CREDITS_SERVICE_SECRET_VIRGO = "virgo-secret"

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ledgerEntryId: "entry-1",
          balanceAfter: 1000,
          duplicate: false,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { debitCreditsForUser } = await import("./credits")
    await debitCreditsForUser({
      clerkUserId: "user_123",
      amount: 200,
      reason: "virgo.card_summary",
      idempotencyKey: "key-1",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.example/api/credits/debit",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer virgo-secret",
        }),
      }),
    )
  })

  it("falls back to the shared secret when no Virgo-specific secret is configured", async () => {
    process.env.CREDITS_SERVICE_SECRET = "generic-secret"
    delete process.env.CREDITS_SERVICE_SECRET_VIRGO

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ledgerEntryId: "entry-1",
          balanceAfter: 1000,
          duplicate: false,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { debitCreditsForUser } = await import("./credits")
    await debitCreditsForUser({
      clerkUserId: "user_123",
      amount: 200,
      reason: "virgo.card_summary",
      idempotencyKey: "key-1",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.example/api/credits/debit",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer generic-secret",
        }),
      }),
    )
  })
})
