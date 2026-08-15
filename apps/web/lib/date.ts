type RelativeTimeUnit = 'now' | 'minute' | 'hour' | 'day' | 'month' | 'year'
type RelativeTimeUnitLabels = Record<RelativeTimeUnit, string>

const EN_RELATIVE_TIME_UNITS: RelativeTimeUnitLabels = {
  now: 'now',
  minute: 'm',
  hour: 'h',
  day: 'd',
  month: 'mo',
  year: 'y',
}

const COMPACT_RELATIVE_TIME_UNITS: Record<string, RelativeTimeUnitLabels> = {
  en: EN_RELATIVE_TIME_UNITS,
  fr: { now: 'maint.', minute: 'min', hour: 'h', day: 'j', month: 'mois', year: 'an' },
  it: { now: 'ora', minute: 'min', hour: 'h', day: 'g', month: 'mese', year: 'anno' },
  no: { now: 'nå', minute: 'min', hour: 't', day: 'd', month: 'mnd', year: 'år' },
  pt: { now: 'agora', minute: 'min', hour: 'h', day: 'd', month: 'mês', year: 'a' },
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

export type LocalizedDateInput = Date | string | number | null | undefined

export function formatLocalizedDate(
  value: LocalizedDateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
) {
  const dateOnly = parseCalendarDate(value)

  if (dateOnly) {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: 'UTC',
    }).format(dateOnly)
  }

  const date = parseInstantDate(value)

  if (!date || Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

function parseCalendarDate(value: LocalizedDateInput) {
  if (typeof value !== 'string') return null

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!dateOnlyMatch) return null

  const [, year, month, day] = dateOnlyMatch
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function parseInstantDate(value: LocalizedDateInput) {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value !== 'string') return null

  return new Date(value)
}

function parseRelativeDate(value: LocalizedDateInput) {
  if (typeof value === 'string') {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch
      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }

  return parseInstantDate(value)
}

function localeBase(locale: string) {
  return locale.split('-')[0]?.toLowerCase() ?? 'en'
}

export function formatCompactRelativeTime(
  value: LocalizedDateInput,
  locale: string,
  now: Date = new Date()
) {
  const date = parseRelativeDate(value)
  if (!date || Number.isNaN(date.getTime())) return ''

  const units = COMPACT_RELATIVE_TIME_UNITS[localeBase(locale)] ?? EN_RELATIVE_TIME_UNITS

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${date.getHours()}${units.hour}`
  }

  const diffMs = Math.max(0, now.getTime() - date.getTime())

  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}${units.hour}`
  if (diffMs < MONTH_MS) return `${Math.floor(diffMs / DAY_MS)}${units.day}`
  if (diffMs < YEAR_MS) return `${Math.floor(diffMs / MONTH_MS)}${units.month}`

  return `${Math.floor(diffMs / YEAR_MS)}${units.year}`
}

export function formatLocalizedRelativeTime(
  value: LocalizedDateInput,
  translate: (key: string, options?: { count?: number }) => string,
  now: Date = new Date()
) {
  const date = parseRelativeDate(value)
  if (!date || Number.isNaN(date.getTime())) return translate('activity.justNow')

  const diffMs = Math.max(0, now.getTime() - date.getTime())
  if (diffMs < MINUTE_MS) return translate('activity.justNow')

  const units = [
    { key: 'minute', size: MINUTE_MS },
    { key: 'hour', size: HOUR_MS },
    { key: 'day', size: DAY_MS },
    { key: 'week', size: 7 * DAY_MS },
    { key: 'month', size: MONTH_MS },
    { key: 'year', size: YEAR_MS },
  ] as const
  const unit = [...units].reverse().find((candidate) => diffMs >= candidate.size) ?? units[0]
  const count = Math.floor(diffMs / unit.size)
  const key = `activity.${unit.key}${count === 1 ? 'Ago' : 'sAgo'}`
  return translate(key, { count })
}
