export type CompactDurationTranslator = (key: string) => string

const COMPACT_DURATION_UNITS = {
  en: { day: 'd', hour: 'h', minute: 'm' },
  pt: { day: 'd', hour: 'h', minute: 'min' },
  fr: { day: 'j', hour: 'h', minute: 'min' },
  it: { day: 'g', hour: 'h', minute: 'min' },
  no: { day: 'd', hour: 't', minute: 'min' },
  nb: { day: 'd', hour: 't', minute: 'min' },
  es: { day: 'd', hour: 'h', minute: 'min' },
  de: { day: 'T', hour: 'Std.', minute: 'Min.' },
} as const

function getCompactDurationUnits(locale: string) {
  const language = locale.toLowerCase().split(/[-_]/)[0] ?? 'en'

  return (
    COMPACT_DURATION_UNITS[language as keyof typeof COMPACT_DURATION_UNITS] ??
    COMPACT_DURATION_UNITS.en
  )
}

function translatedUnit(t: CompactDurationTranslator | undefined, key: string, fallback: string) {
  if (!t) return fallback

  const translated = t(key)

  return translated && translated !== key ? translated : fallback
}

export function formatWatchTimeCompact(
  totalMinutes: number,
  locale: string,
  t?: CompactDurationTranslator
) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes))
  const days = Math.floor(safeMinutes / (24 * 60))
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60)
  const minutes = safeMinutes % 60

  const formatter = new Intl.NumberFormat(locale)
  const fallback = getCompactDurationUnits(locale)

  const dayShort = translatedUnit(t, 'stats.duration.dayShort', fallback.day)
  const hourShort = translatedUnit(t, 'stats.duration.hourShort', fallback.hour)
  const minuteShort = translatedUnit(t, 'stats.duration.minuteShort', fallback.minute)

  if (days > 0) {
    return hours > 0
      ? `${formatter.format(days)}${dayShort} ${formatter.format(hours)}${hourShort}`
      : `${formatter.format(days)}${dayShort}`
  }

  if (hours > 0) {
    return minutes > 0
      ? `${formatter.format(hours)}${hourShort} ${formatter.format(minutes)}${minuteShort}`
      : `${formatter.format(hours)}${hourShort}`
  }

  return `${formatter.format(minutes)}${minuteShort}`
}
