import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { api } from "./_generated/api"
import { getClerkUserIdOrNull } from "./lib/auth"
import {
  debitCreditsForUser,
  isCreditsEnforcementEnabled,
  SUMMARY_CREDIT_COST,
} from "./lib/credits"

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://virgo.sdee3.com",
  "https://astro-mate.sdee3.com",
]

type DatingMatchContext = {
  type: "dating-match"
  sourceApp: "astro-mate"
  matchDisplayName: string
  viewer: { sunSign: string; moonSign: string; ascendantSign: string }
  candidate: { sunSign: string; moonSign: string; ascendantSign: string }
  synastry?: {
    overallBand?: "low" | "medium" | "high"
    overallScore?: number
    highlights?: string[]
    cautions?: string[]
  }
  targetProfileId?: string
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin")
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2]

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Device-Id, Authorization",
    Vary: "Origin",
  }
}

function getDeviceId(request: Request): string | null {
  const header = request.headers.get("x-device-id")?.trim()
  if (header && header.length <= 128) return header
  return null
}

function isNonEmptyString(value: unknown, maxLen: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen
}

function validateBigThree(
  value: unknown,
  label: string,
): { sunSign: string; moonSign: string; ascendantSign: string } | null {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (
    !isNonEmptyString(obj.sunSign, 32) ||
    !isNonEmptyString(obj.moonSign, 32) ||
    !isNonEmptyString(obj.ascendantSign, 32)
  ) {
    return null
  }
  return {
    sunSign: obj.sunSign.trim(),
    moonSign: obj.moonSign.trim(),
    ascendantSign: obj.ascendantSign.trim(),
  }
}

function validateStringArray(
  value: unknown,
  maxItems: number,
  maxItemLen: number,
): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null as never
  if (value.length > maxItems) return null as never
  const items: string[] = []
  for (const item of value) {
    if (!isNonEmptyString(item, maxItemLen)) return null as never
    items.push(item.trim())
  }
  return items
}

function validateDatingMatchContext(
  value: unknown,
): { ok: true; context: DatingMatchContext } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Invalid context" }
  }

  const raw = value as Record<string, unknown>

  if (raw.type !== "dating-match") {
    return { ok: false, error: "Invalid context type" }
  }

  if (raw.sourceApp !== "astro-mate") {
    return { ok: false, error: "Invalid sourceApp" }
  }

  if (!isNonEmptyString(raw.matchDisplayName, 64)) {
    return { ok: false, error: "matchDisplayName is required" }
  }

  const viewer = validateBigThree(raw.viewer, "viewer")
  if (!viewer) {
    return { ok: false, error: "viewer Big Three is required" }
  }

  const candidate = validateBigThree(raw.candidate, "candidate")
  if (!candidate) {
    return { ok: false, error: "candidate Big Three is required" }
  }

  let synastry: DatingMatchContext["synastry"]
  if (raw.synastry !== undefined) {
    if (!raw.synastry || typeof raw.synastry !== "object") {
      return { ok: false, error: "Invalid synastry block" }
    }
    const syn = raw.synastry as Record<string, unknown>
    if (
      syn.overallBand !== undefined &&
      syn.overallBand !== "low" &&
      syn.overallBand !== "medium" &&
      syn.overallBand !== "high"
    ) {
      return { ok: false, error: "Invalid synastry overallBand" }
    }
    if (
      syn.overallScore !== undefined &&
      (typeof syn.overallScore !== "number" ||
        !Number.isFinite(syn.overallScore) ||
        syn.overallScore < 0 ||
        syn.overallScore > 100)
    ) {
      return { ok: false, error: "Invalid synastry overallScore" }
    }

    const highlights = validateStringArray(syn.highlights, 2, 200)
    if (highlights === (null as never)) {
      return { ok: false, error: "Invalid synastry highlights" }
    }
    const cautions = validateStringArray(syn.cautions, 2, 200)
    if (cautions === (null as never)) {
      return { ok: false, error: "Invalid synastry cautions" }
    }

    synastry = {
      overallBand: syn.overallBand as DatingMatchContext["synastry"] extends infer S
        ? S extends { overallBand?: infer B }
          ? B
          : never
        : never,
      overallScore: syn.overallScore as number | undefined,
      highlights,
      cautions,
    }
  }

  if (
    raw.targetProfileId !== undefined &&
    !isNonEmptyString(raw.targetProfileId, 128)
  ) {
    return { ok: false, error: "Invalid targetProfileId" }
  }

  return {
    ok: true,
    context: {
      type: "dating-match",
      sourceApp: "astro-mate",
      matchDisplayName: raw.matchDisplayName.trim(),
      viewer,
      candidate,
      synastry,
      targetProfileId:
        typeof raw.targetProfileId === "string"
          ? raw.targetProfileId.trim()
          : undefined,
    },
  }
}

function buildDatingMatchUserMessage(
  cardName: string,
  context: DatingMatchContext,
): string {
  const { matchDisplayName, viewer, candidate, synastry } = context
  const lines = [
    `The user is exploring a potential romantic connection with ${matchDisplayName}.`,
    `Viewer Big Three: Sun ${viewer.sunSign}, Moon ${viewer.moonSign}, Ascendant ${viewer.ascendantSign}.`,
    `Candidate Big Three: Sun ${candidate.sunSign}, Moon ${candidate.moonSign}, Ascendant ${candidate.ascendantSign}.`,
  ]

  if (synastry?.overallBand) {
    lines.push(`Synastry overall band: ${synastry.overallBand}.`)
  }
  if (synastry?.overallScore !== undefined) {
    lines.push(`Synastry score: ${Math.round(synastry.overallScore)}.`)
  }
  if (synastry?.highlights?.length) {
    lines.push(`Highlights: ${synastry.highlights.join("; ")}.`)
  }
  if (synastry?.cautions?.length) {
    lines.push(`Cautions: ${synastry.cautions.join("; ")}.`)
  }

  lines.push(
    `They drew ${cardName}. Interpret this card specifically in light of this connection — chemistry, communication, emotional fit — in 2–3 warm second-person sentences. Do not claim certainty about the other person's feelings.`,
  )

  if (cardName.startsWith("Reversed ")) {
    lines.push(
      "Since the card is reversed, address how its energy may be blocked, internalized, or requiring deeper introspection.",
    )
  }

  return lines.join("\n")
}

const http = httpRouter()

function optionsHandler() {
  return httpAction(async (_ctx, request) => {
    return new Response(null, { headers: corsHeaders(request) })
  })
}

http.route({
  path: "/summarize",
  method: "OPTIONS",
  handler: optionsHandler(),
})

http.route({
  path: "/readings",
  method: "OPTIONS",
  handler: optionsHandler(),
})

http.route({
  path: "/device/link",
  method: "OPTIONS",
  handler: optionsHandler(),
})

http.route({
  path: "/device/link",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    }

    const deviceId = getDeviceId(request)
    const clerkUserId = await getClerkUserIdOrNull(ctx)

    if (!deviceId) {
      return new Response(JSON.stringify({ error: "X-Device-Id header is required" }), {
        status: 400,
        headers,
      })
    }

    if (!clerkUserId) {
      return new Response(JSON.stringify({ error: "Authorization is required" }), {
        status: 401,
        headers,
      })
    }

    try {
      const result = await ctx.runMutation(api.readings.linkDeviceToUser, {
        deviceId,
      })
      return new Response(JSON.stringify(result), { headers })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to link device"
      const status = message.includes("already linked") ? 409 : 400
      return new Response(JSON.stringify({ error: message }), { status, headers })
    }
  }),
})

http.route({
  path: "/readings",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    }

    const deviceId = getDeviceId(request)
    const clerkUserId = await getClerkUserIdOrNull(ctx)

    if (!deviceId && !clerkUserId) {
      return new Response(
        JSON.stringify({
          error: "X-Device-Id header or Authorization is required",
        }),
        { status: 400, headers },
      )
    }

    const url = new URL(request.url)
    const limitParam = url.searchParams.get("limit")
    const skipParam = url.searchParams.get("skip")
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 3
    const skip = skipParam ? Number.parseInt(skipParam, 10) : 0

    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: "Invalid limit" }), {
        status: 400,
        headers,
      })
    }

    if (!Number.isFinite(skip) || skip < 0) {
      return new Response(JSON.stringify({ error: "Invalid skip" }), {
        status: 400,
        headers,
      })
    }

    const result = await ctx.runQuery(api.readings.listReadings, {
      deviceId: deviceId ?? "",
      clerkUserId: clerkUserId ?? undefined,
      limit,
      skip,
    })

    return new Response(JSON.stringify(result), { headers })
  }),
})

http.route({
  path: "/summarize",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    }

    const deviceId = getDeviceId(request)
    const clerkUserId = await getClerkUserIdOrNull(ctx)

    if (!deviceId && !clerkUserId) {
      return new Response(
        JSON.stringify({
          error: "X-Device-Id header or Authorization is required",
        }),
        { status: 400, headers },
      )
    }

    const body: {
      cardName?: string
      drawnAt?: number
      context?: unknown
    } = await request.json()

    if (!body.cardName) {
      return new Response(JSON.stringify({ error: "cardName is required" }), {
        status: 400,
        headers,
      })
    }

    let datingContext: DatingMatchContext | undefined
    if (body.context !== undefined) {
      const validated = validateDatingMatchContext(body.context)
      if (!validated.ok) {
        return new Response(JSON.stringify({ error: validated.error }), {
          status: 400,
          headers,
        })
      }
      datingContext = validated.context
    }

    const { allowed, remaining } = await ctx.runMutation(
      api.summarize.checkAndRecordRateLimit,
      {
        deviceId: deviceId ?? undefined,
        clerkUserId: clerkUserId ?? undefined,
      },
    )

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "You've reached the limit of 20 card readings per 60 minutes.",
          remaining: 0,
        }),
        { status: 429, headers },
      )
    }

    const creditReason = datingContext
      ? "virgo.dating_match_summary"
      : "virgo.card_summary"

    if (clerkUserId && isCreditsEnforcementEnabled()) {
      const idempotencyKey = `virgo:summary:${clerkUserId}:${body.drawnAt ?? Date.now()}:${body.cardName}`
      try {
        await debitCreditsForUser({
          clerkUserId,
          amount: SUMMARY_CREDIT_COST,
          reason: creditReason,
          idempotencyKey,
          metadata: {
            cardName: body.cardName,
            ...(datingContext ? { contextType: "dating-match" } : {}),
          },
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Insufficient credits"
        const status = message.includes("Insufficient") ? 402 : 503
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers,
        })
      }
    }

    const model = process.env.OPENROUTER_MODEL
    const apiKey = process.env.OPENROUTER_API_KEY

    if (!model || !apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured." }),
        { status: 500, headers },
      )
    }

    const userMessage = datingContext
      ? buildDatingMatchUserMessage(body.cardName, datingContext)
      : `Card drawn: ${body.cardName}
The user has drawn this card seeking guidance on a question in their life. Speak to the card's general wisdom — its energy, themes, and what reflection it invites.${body.cardName.startsWith("Reversed ") ? " Since the card is reversed, address how its energy may be blocked, internalized, or requiring deeper introspection." : ""}`

    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.OPENROUTER_REFERER ?? "https://virgo.sdee3.com",
          "X-OpenRouter-Title": process.env.OPENROUTER_TITLE ?? "Virgo",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an intuitive tarot reader. Provide insightful card interpretations in a warm, reflective tone. Write in second person to make the reading feel personal and direct. Each reading should be 2-3 sentences.",
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          service_tier: "flex",
          max_tokens: 200,
        }),
      },
    )

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text()
      console.error("OpenRouter error:", openRouterResponse.status, errorBody)
      return new Response(
        JSON.stringify({ error: "Failed to get card interpretation." }),
        { status: 502, headers },
      )
    }

    const data = await openRouterResponse.json()
    const summary =
      data.choices?.[0]?.message?.content ?? "No interpretation available."

    const drawnAt =
      typeof body.drawnAt === "number" && Number.isFinite(body.drawnAt)
        ? body.drawnAt
        : Date.now()

    await ctx.runMutation(api.readings.saveReading, {
      deviceId: deviceId ?? `user:${clerkUserId}`,
      clerkUserId: clerkUserId ?? undefined,
      cardName: body.cardName,
      summary,
      drawnAt,
      contextType: datingContext ? "dating-match" : undefined,
      sourceApp: datingContext?.sourceApp,
      targetProfileId: datingContext?.targetProfileId,
    })

    return new Response(JSON.stringify({ summary, remaining }), { headers })
  }),
})

export default http
