const dayMs = 86_400_000

export function dayKeyUtc(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function last3CalendarDayKeys(now = Date.now()): string[] {
  const keys: string[] = []
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  for (let i = 0; i < 3; i++) {
    keys.push(dayKeyUtc(today.getTime() - i * dayMs))
  }
  return keys.sort()
}

export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const key = keyFn(item)
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

export function summarizeLast3CalendarDays<T, E extends { at: number }>(
  items: T[],
  tsFn: (item: T) => number | null | undefined,
  mapEvent: (item: T, dateKey: string, at: number) => E,
  now = Date.now(),
) {
  const dayKeys = last3CalendarDayKeys(now)
  const byDay = Object.fromEntries(dayKeys.map((key) => [key, 0])) as Record<
    string,
    number
  >
  const events: E[] = []
  let total = 0

  for (const item of items) {
    const ts = tsFn(item)
    if (ts == null) {
      continue
    }
    const key = dayKeyUtc(ts)
    if (!(key in byDay)) {
      continue
    }
    byDay[key]++
    total++
    events.push(mapEvent(item, key, ts))
  }

  events.sort((a, b) => b.at - a.at)

  return {
    total,
    byDay: dayKeys.map((dateKey) => ({
      dateKey,
      count: byDay[dateKey] ?? 0,
    })),
    events,
  }
}
