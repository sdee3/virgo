import { CONVEX_SITE_URL } from "../data/constants"
import { getDeviceId } from "./deviceId"
import type { ReadingsResponse, SummaryResponse } from "../types"

function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
  }
}

export async function fetchPreviousReadings(): Promise<ReadingsResponse> {
  const res = await fetch(`${CONVEX_SITE_URL}/readings`, {
    headers: apiHeaders(),
  })
  const data: ReadingsResponse = await res.json()
  if (!res.ok) {
    throw new Error(data.error || "Could not load previous readings.")
  }
  return data
}

export async function summarizeCard(
  cardName: string,
): Promise<SummaryResponse> {
  const res = await fetch(`${CONVEX_SITE_URL}/summarize`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ cardName }),
  })
  const data: SummaryResponse = await res.json()
  if (!res.ok) {
    throw new Error(data.error || "Unknown error")
  }
  return data
}
