import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { api } from "./_generated/api"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Device-Id",
}

function getDeviceId(request: Request): string | null {
  const header = request.headers.get("x-device-id")?.trim()
  if (header && header.length <= 128) return header
  return null
}

const http = httpRouter()

function optionsHandler() {
  return httpAction(async () => {
    return new Response(null, { headers: corsHeaders })
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
  path: "/readings",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "Content-Type": "application/json",
      ...corsHeaders,
    }

    const deviceId = getDeviceId(request)
    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "X-Device-Id header is required" }),
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
      deviceId,
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
      ...corsHeaders,
    }

    const deviceId = getDeviceId(request)
    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "X-Device-Id header is required" }),
        { status: 400, headers },
      )
    }

    const body: { cardName?: string; drawnAt?: number } = await request.json()

    if (!body.cardName) {
      return new Response(JSON.stringify({ error: "cardName is required" }), {
        status: 400,
        headers,
      })
    }

    const { allowed, remaining } = await ctx.runMutation(
      api.summarize.checkAndRecordRateLimit,
      { deviceId },
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

    const model = process.env.OPENROUTER_MODEL
    const apiKey = process.env.OPENROUTER_API_KEY

    if (!model || !apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured." }),
        { status: 500, headers },
      )
    }

    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "https://virgo.sdee3.com",
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
              content: `Card drawn: ${body.cardName}
The user has drawn this card seeking guidance on a question in their life. Speak to the card's general wisdom — its energy, themes, and what reflection it invites.${body.cardName.startsWith("Reversed ") ? " Since the card is reversed, address how its energy may be blocked, internalized, or requiring deeper introspection." : ""}`,
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
      deviceId,
      cardName: body.cardName,
      summary,
      drawnAt,
    })

    return new Response(JSON.stringify({ summary, remaining }), { headers })
  }),
})

export default http
