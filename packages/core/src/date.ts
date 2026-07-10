export type DateInput = Date | string | number | null | undefined

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toDate(value: DateInput) {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const normalized =
    typeof value === 'number'
      ? new Date(value)
      : new Date(ISO_DATE_ONLY_PATTERN.test(value.trim()) ? `${value.trim()}T12:00:00` : value)

  return Number.isNaN(normalized.getTime()) ? null : normalized
}

export function parseDateOnly(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()
  if (!ISO_DATE_ONLY_PATTERN.test(trimmed)) return toDate(trimmed)

  const [yearPart, monthPart, dayPart] = trimmed.split('-')
  if (!yearPart || !monthPart || !dayPart) return null
  const year = Number.parseInt(yearPart, 10)
  const month = Number.parseInt(monthPart, 10)
  const day = Number.parseInt(dayPart, 10)
  if (![year, month, day].every(Number.isFinite)) return null

  const normalized = new Date(year, month - 1, day)

  return Number.isNaN(normalized.getTime()) ? null : normalized
}

export function isFutureDateOnly(value: string | null | undefined, now = new Date()) {
  const date = parseDateOnly(value)
  return date ? date > now : false
}

export function formatDate(value: DateInput) {
  const date = toDate(value)
  if (!date) return typeof value === 'string' ? value : ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}
