import { CONVEX_SITE_URL } from "../data/constants"
import { getDeviceId } from "./deviceId"
import type { ReadingsResponse, SummaryResponse } from "../types"

function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
  }
}

export async function fetchReadings(
  limit: number,
  skip = 0,
): Promise<ReadingsResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    skip: String(skip),
  })
  const res = await fetch(`${CONVEX_SITE_URL}/readings?${params}`, {
    headers: apiHeaders(),
  })
  const data: ReadingsResponse = await res.json()
  if (!res.ok) {
    throw new Error(data.error || "Could not load past readings.")
  }
  return data
}

export async function summarizeCard(
  cardName: string,
  drawnAt: number,
): Promise<SummaryResponse> {
  const res = await fetch(`${CONVEX_SITE_URL}/summarize`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ cardName, drawnAt }),
  })
  const data: SummaryResponse = await res.json()
  if (!res.ok) {
    throw new Error(data.error || "Unknown error")
  }
  return data
}
