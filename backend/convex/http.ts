import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { api } from "./_generated/api"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const http = httpRouter()

http.route({
  path: "/summarize",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { headers: corsHeaders })
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

    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"

    const body: { cardName?: string } = await request.json()

    if (!body.cardName) {
      return new Response(JSON.stringify({ error: "cardName is required" }), {
        status: 400,
        headers,
      })
    }

    const { allowed, remaining } = await ctx.runMutation(
      api.summarize.checkAndRecordRateLimit,
      { ip },
    )

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error:
            "You've reached the limit of 3 card readings per 60 minutes. Please wait before drawing another card.",
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
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a tarot card reader. Provide a concise, insightful 2-3 sentence interpretation.",
            },
            {
              role: "user",
              content: `Answer the question of the user, which is unknown to us, using the following tarot card: ${body.cardName}`,
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

    return new Response(JSON.stringify({ summary, remaining }), { headers })
  }),
})

export default http
