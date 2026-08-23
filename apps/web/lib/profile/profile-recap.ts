import { slugify } from '../routes'

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

export function formatProfileMonth(year: number, month: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function profileStoryFilename(username: string, year: number, month: number) {
  const safeUsername = slugify(username || 'kino-member') || 'kino-member'
  const monthPart = String(month).padStart(2, '0')
  return `kino-${safeUsername}-${year}-${monthPart}.png`
}
