import type { ProfileMonthlyRecapActivityDay } from '@kino/core'

export type MonthlyCalendarIntensityLevel = 0 | 1 | 2 | 3 | 4

export interface MonthlyCalendarCell {
  date: string
  inMonth: boolean
  activity: ProfileMonthlyRecapActivityDay | null
  level: MonthlyCalendarIntensityLevel
}

export interface MonthlyCalendarModel {
  weeks: MonthlyCalendarCell[][]
  activeDays: number
  longestStreak: number
  mostActiveDay: ProfileMonthlyRecapActivityDay | null
  biggestBingeDay: ProfileMonthlyRecapActivityDay | null
  maxMinutes: number
}

const DAY_MS = 86_400_000

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function parseDateOnlyKey(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function startOfWeekUtc(date: Date, weekStartsOn: 0 | 1) {
  const day = date.getUTCDay()
  const diff = (day - weekStartsOn + 7) % 7
  return addDaysUtc(date, -diff)
}

function isInMonth(date: Date, year: number, month: number) {
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
}

function isActiveDay(activity: ProfileMonthlyRecapActivityDay) {
  return activity.moviesWatched > 0 || activity.episodesWatched > 0
}

function compareDatesAscending(a: string, b: string) {
  return a.localeCompare(b)
}

function buildIntensityLevels(activities: ProfileMonthlyRecapActivityDay[]) {
  const positiveMinutes = activities
    .map((activity) => activity.minutes)
    .filter((minutes) => minutes > 0)

  if (positiveMinutes.length === 0) {
    return { minMinutes: 0, maxMinutes: 0 }
  }

  const minMinutes = Math.min(...positiveMinutes)
  const maxMinutes = Math.max(...positiveMinutes)

  return { minMinutes, maxMinutes }
}

function intensityLevelForMinutes(
  minutes: number,
  minMinutes: number,
  maxMinutes: number
): MonthlyCalendarIntensityLevel {
  if (minutes <= 0) {
    return 0
  }

  if (minMinutes === maxMinutes) {
    return 4
  }

  const normalized = (minutes - minMinutes) / (maxMinutes - minMinutes)

  if (normalized <= 0) {
    return 1
  }

  if (normalized < 0.25) {
    return 1
  }

  if (normalized < 0.5) {
    return 2
  }

  if (normalized < 0.75) {
    return 3
  }

  return 4
}

function pickMostActiveDay(activities: ProfileMonthlyRecapActivityDay[]) {
  const sorted = [...activities].sort(
    (a, b) => b.minutes - a.minutes || compareDatesAscending(a.date, b.date)
  )
  return sorted[0] ?? null
}

function pickBiggestBingeDay(activities: ProfileMonthlyRecapActivityDay[]) {
  const sorted = [...activities].sort(
    (a, b) =>
      b.episodesWatched - a.episodesWatched ||
      b.minutes - a.minutes ||
      compareDatesAscending(a.date, b.date)
  )
  return sorted[0] ?? null
}

function countActiveDays(activities: ProfileMonthlyRecapActivityDay[]) {
  return activities.reduce((count, activity) => count + (isActiveDay(activity) ? 1 : 0), 0)
}

function longestStreakFromActivities(activities: ProfileMonthlyRecapActivityDay[]) {
  const activeDates = activities
    .filter(isActiveDay)
    .map((activity) => activity.date)
    .sort(compareDatesAscending)

  if (activeDates.length === 0) {
    return 0
  }

  let longest = 1
  let current = 1
  const firstActiveDate = activeDates[0]
  if (!firstActiveDate) {
    return 0
  }

  let previous = parseDateOnlyKey(firstActiveDate)

  for (let index = 1; index < activeDates.length; index += 1) {
    const activeDate = activeDates[index]
    if (!activeDate) {
      current = 1
      previous = null
      continue
    }

    const currentDate = parseDateOnlyKey(activeDate)
    if (!previous || !currentDate) {
      current = 1
      previous = currentDate
      continue
    }

    if (currentDate.getTime() - previous.getTime() === DAY_MS) {
      current += 1
    } else {
      current = 1
    }

    if (current > longest) {
      longest = current
    }

    previous = currentDate
  }

  return longest
}

export function buildMonthlyWatchCalendar(input: {
  year: number
  month: number
  dailyActivity: ProfileMonthlyRecapActivityDay[]
  weekStartsOn?: 0 | 1
}): MonthlyCalendarModel {
  const weekStartsOn = input.weekStartsOn ?? 1
  const monthStart = new Date(Date.UTC(input.year, input.month - 1, 1))
  const lastDayOfMonth = new Date(Date.UTC(input.year, input.month, 0))
  const firstGridDay = startOfWeekUtc(monthStart, weekStartsOn)
  const lastGridDay = addDaysUtc(startOfWeekUtc(lastDayOfMonth, weekStartsOn), 7)
  const totalDays = Math.round((lastGridDay.getTime() - firstGridDay.getTime()) / DAY_MS)

  const activitiesByDate = new Map<string, ProfileMonthlyRecapActivityDay>()

  for (const activity of input.dailyActivity) {
    const parsed = parseDateOnlyKey(activity.date)
    if (!parsed || !isInMonth(parsed, input.year, input.month)) {
      continue
    }

    const key = toDateKey(parsed)
    const normalizedActivity = { ...activity, date: key }
    if (!isActiveDay(normalizedActivity)) {
      continue
    }

    activitiesByDate.set(key, normalizedActivity)
  }

  const monthActivities = [...activitiesByDate.values()]
  const { minMinutes, maxMinutes } = buildIntensityLevels(monthActivities)
  const activeDays = countActiveDays(monthActivities)
  const longestStreak = longestStreakFromActivities(monthActivities)
  const mostActiveDay = pickMostActiveDay(monthActivities)
  const biggestBingeDay = pickBiggestBingeDay(monthActivities)
  const monthMaxMinutes = monthActivities.reduce(
    (highest, activity) => Math.max(highest, activity.minutes),
    0
  )

  const weeks: MonthlyCalendarCell[][] = []

  for (let offset = 0; offset < totalDays; offset += 7) {
    const week: MonthlyCalendarCell[] = []

    for (let index = 0; index < 7; index += 1) {
      const date = addDaysUtc(firstGridDay, offset + index)
      const dateKey = toDateKey(date)
      const inMonth = isInMonth(date, input.year, input.month)
      const activity = inMonth ? (activitiesByDate.get(dateKey) ?? null) : null
      const level: MonthlyCalendarIntensityLevel = activity
        ? intensityLevelForMinutes(activity.minutes, minMinutes, maxMinutes)
        : 0

      week.push({
        date: dateKey,
        inMonth,
        activity,
        level,
      })
    }

    weeks.push(week)
  }

  return {
    weeks,
    activeDays,
    longestStreak,
    mostActiveDay,
    biggestBingeDay,
    maxMinutes: monthMaxMinutes,
  }
}
