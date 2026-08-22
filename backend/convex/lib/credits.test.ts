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

  it("uses the Virgo-specific service secret", async () => {
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

  it("throws when the Virgo-specific service secret is missing", async () => {
    delete process.env.CREDITS_SERVICE_SECRET_VIRGO

    const { debitCreditsForUser } = await import("./credits")
    await expect(
      debitCreditsForUser({
        clerkUserId: "user_123",
        amount: 200,
        reason: "virgo.card_summary",
        idempotencyKey: "key-1",
      }),
    ).rejects.toThrow(/not configured/i)
  })
})

describe("hasPremiumEntitlementForUser", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    process.env.IDENTITY_CONVEX_SITE_URL = "https://identity.example"
    process.env.CREDITS_SERVICE_SECRET_VIRGO = "virgo-secret"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("returns true when the identity entitlement is active", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ isPremium: true, periodEnd: 1_900_000_000_000, source: "stripe" }),
        { headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { hasPremiumEntitlementForUser } = await import("./credits")
    const result = await hasPremiumEntitlementForUser("user_123")

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.example/api/premium/status",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer virgo-secret",
        }),
      }),
    )
  })

  it("returns false when not premium", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ isPremium: false, periodEnd: null, source: null }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    )

    const { hasPremiumEntitlementForUser } = await import("./credits")
    await expect(hasPremiumEntitlementForUser("user_123")).resolves.toBe(false)
  })

  it("returns false on a non-ok or failed lookup (fail-open toward charging)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })))

    const { hasPremiumEntitlementForUser } = await import("./credits")
    await expect(hasPremiumEntitlementForUser("user_123")).resolves.toBe(false)
  })

  it("returns false when the service secret is missing", async () => {
    delete process.env.CREDITS_SERVICE_SECRET_VIRGO

    const { hasPremiumEntitlementForUser } = await import("./credits")
    await expect(hasPremiumEntitlementForUser("user_123")).resolves.toBe(false)
  })
})
