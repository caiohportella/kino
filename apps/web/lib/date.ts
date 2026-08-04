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
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : typeof value === 'string'
          ? new Date(value)
          : null

  if (!date || Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

function localeBase(locale: string) {
  return locale.split('-')[0]?.toLowerCase() ?? 'en'
}

export function formatCompactRelativeTime(
  value: LocalizedDateInput,
  locale: string,
  now: Date = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : typeof value === 'string'
          ? new Date(value)
          : null
  if (!date || Number.isNaN(date.getTime())) return ''

  const units = COMPACT_RELATIVE_TIME_UNITS[localeBase(locale)] ?? EN_RELATIVE_TIME_UNITS
  const diffMs = Math.max(0, now.getTime() - date.getTime())

  if (diffMs < MINUTE_MS) return units.now
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}${units.minute}`
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}${units.hour}`
  if (diffMs < MONTH_MS) return `${Math.floor(diffMs / DAY_MS)}${units.day}`
  if (diffMs < YEAR_MS) return `${Math.floor(diffMs / MONTH_MS)}${units.month}`
  return `${Math.floor(diffMs / YEAR_MS)}${units.year}`
}
