const STORAGE_KEY = "virgo-device-id"

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Stable anonymous id for this browser; used to scope readings and rate limits. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id = createDeviceId()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return createDeviceId()
  }
}
