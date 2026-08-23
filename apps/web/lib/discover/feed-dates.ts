const DAY_MS = 24 * 60 * 60 * 1000

export const DISCOVER_RECENT_RELEASE_DAYS = 45
export const DISCOVER_UPCOMING_DAYS = 90

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getDiscoverDateWindow(now = new Date()) {
  const today = startOfUtcDay(now)

  return {
    recentStart: toDateOnly(addUtcDays(today, -DISCOVER_RECENT_RELEASE_DAYS)),
    today: toDateOnly(today),
    tomorrow: toDateOnly(addUtcDays(today, 1)),
    upcomingEnd: toDateOnly(addUtcDays(today, DISCOVER_UPCOMING_DAYS)),
  }
}

export function isDateOnlyWithin(value: string | null | undefined, min: string, max: string) {
  return Boolean(value && value >= min && value <= max)
}
