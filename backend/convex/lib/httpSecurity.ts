const SUITS = ["Cups", "Pentacles", "Swords", "Wands"] as const

const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
] as const

const MAJOR_ARCANA = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
] as const

const REVERSAL_PREFIX = "Reversed "

export const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://virgo.sdee3.com",
  "https://astro-mate.sdee3.com",
] as const

export const MAX_CARD_NAME_LENGTH = 100
export const MAX_SUMMARY_LENGTH = 600

const VALID_CARD_NAMES = new Set<string>([
  ...MAJOR_ARCANA,
  ...SUITS.flatMap((suit) => RANKS.map((rank) => `${rank} of ${suit}`)),
])

type CorsResult = {
  allowed: boolean
  headers: Record<string, string>
}

export function buildCorsHeaders(origin: string | null): CorsResult {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Device-Id, Authorization",
    Vary: "Origin",
  }

  if (!origin) {
    return { allowed: true, headers }
  }

  if (!ALLOWED_ORIGINS.includes(origin as (typeof ALLOWED_ORIGINS)[number])) {
    return { allowed: false, headers }
  }

  return {
    allowed: true,
    headers: {
      ...headers,
      "Access-Control-Allow-Origin": origin,
    },
  }
}

export function extractClientIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for")
  if (!header) {
    return null
  }

  const firstHop = header.split(",")[0]?.trim()
  if (!firstHop || firstHop.length > 64) {
    return null
  }

  return firstHop
}

export function validateCardName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_CARD_NAME_LENGTH) {
    return null
  }

  const normalized = trimmed.startsWith(REVERSAL_PREFIX)
    ? trimmed.slice(REVERSAL_PREFIX.length)
    : trimmed

  return VALID_CARD_NAMES.has(normalized) ? trimmed : null
}

export function shouldRequireSummarizeAuth(args: {
  creditsEnforcementEnabled: boolean
  requireAuthSetting: string | undefined
}): boolean {
  if (args.creditsEnforcementEnabled) {
    return true
  }

  return args.requireAuthSetting !== "false"
}

export function isDeviceLinkedToDifferentUser(args: {
  authenticatedUserId: string | null
  linkedUserId: string | null
}): boolean {
  return Boolean(
    args.authenticatedUserId &&
      args.linkedUserId &&
      args.authenticatedUserId !== args.linkedUserId,
  )
}

export function sanitizeSummaryOutput(value: unknown): string {
  const raw = typeof value === "string" ? value : ""
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ")
  const normalizedWhitespace = withoutCodeBlocks
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()

  const capped = normalizedWhitespace.slice(0, MAX_SUMMARY_LENGTH).trimEnd()
  return capped || "No interpretation available."
}
