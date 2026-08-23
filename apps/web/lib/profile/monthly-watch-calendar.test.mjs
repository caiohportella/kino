import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildMonthlyWatchCalendar } from './monthly-watch-calendar.ts'

const monthlyWatchCalendarSource = await readFile(
  new URL('../../components/profile/monthly-watch-calendar.tsx', import.meta.url),
  'utf8'
)

function day(date, overrides = {}) {
  return {
    date,
    entries: 1,
    moviesWatched: 1,
    episodesWatched: 0,
    minutes: 10,
    ...overrides,
  }
}

function cellForDate(model, date) {
  for (const week of model.weeks) {
    for (const cell of week) {
      if (cell.date === date) {
        return cell
      }
    }
  }
  return null
}

test('August 2026 starts with five leading Monday-first slots and ignores September activity', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day('2026-08-01', { minutes: 30 }),
      day('2026-08-31', { minutes: 45 }),
      day('2026-09-01', { minutes: 999 }),
    ],
  })

  assert.equal(model.weeks.length, 6)
  assert.equal(
    model.weeks.every((week) => week.length === 7),
    true
  )
  assert.equal(
    model.weeks[0].slice(0, 5).every((cell) => cell.inMonth === false),
    true
  )
  assert.equal(model.weeks[0][5].date, '2026-08-01')
  assert.equal(model.weeks[0][5].inMonth, true)
  assert.equal(model.weeks[0][5].activity?.minutes, 30)

  const septemberCell = cellForDate(model, '2026-09-01')
  assert.ok(septemberCell)
  assert.equal(septemberCell.inMonth, false)
  assert.equal(septemberCell.activity, null)
})

test('February 2024 leap month keeps the right positions and day count', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2024,
    month: 2,
    dailyActivity: [day('2024-02-29', { minutes: 55 })],
  })

  assert.equal(model.weeks.length, 5)
  assert.equal(model.weeks.flat().length, 35)
  assert.equal(cellForDate(model, '2024-02-01')?.inMonth, true)
  assert.equal(model.weeks[0][3].date, '2024-02-01')
  assert.equal(model.weeks[0][3].inMonth, true)
  assert.equal(model.weeks[4][3].date, '2024-02-29')
  assert.equal(model.weeks[4][3].inMonth, true)
})

test('active days and longest streak come from the same activity map', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [day('2026-08-03'), day('2026-08-04'), day('2026-08-05'), day('2026-08-07')],
  })

  assert.equal(model.activeDays, 4)
  assert.equal(model.longestStreak, 3)
})

test('most active day breaks ties by earliest date', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day('2026-08-09', { minutes: 90 }),
      day('2026-08-08', { minutes: 90 }),
      day('2026-08-10', { minutes: 75 }),
    ],
  })

  assert.equal(model.mostActiveDay?.date, '2026-08-08')
})

test('biggest binge day prefers episode count, then minutes, then earliest date', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day('2026-08-12', { episodesWatched: 2, moviesWatched: 0, minutes: 10 }),
      day('2026-08-11', { episodesWatched: 3, moviesWatched: 0, minutes: 50 }),
      day('2026-08-10', { episodesWatched: 3, moviesWatched: 0, minutes: 70 }),
      day('2026-08-09', { episodesWatched: 3, moviesWatched: 0, minutes: 70 }),
      day('2026-08-08', { episodesWatched: 3, moviesWatched: 0, minutes: 40 }),
    ],
  })

  assert.equal(model.biggestBingeDay?.date, '2026-08-09')
})

test('zero-minute active days and outside-month cells stay at level zero', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [day('2026-08-05', { minutes: 0 }), day('2026-09-01', { minutes: 100 })],
  })

  assert.equal(cellForDate(model, '2026-08-05')?.level, 0)
  assert.equal(cellForDate(model, '2026-09-01')?.activity, null)
  assert.equal(cellForDate(model, '2026-09-01')?.level, 0)
})

test('inactive zero-count daily objects do not create activity cells or featured days', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day('2026-08-05', {
        entries: 1,
        moviesWatched: 0,
        episodesWatched: 0,
        minutes: 120,
      }),
      day('2026-08-06', {
        entries: 0,
        moviesWatched: 0,
        episodesWatched: 0,
        minutes: 0,
      }),
    ],
  })

  assert.equal(model.activeDays, 0)
  assert.equal(model.longestStreak, 0)
  assert.equal(model.mostActiveDay, null)
  assert.equal(model.biggestBingeDay, null)
  assert.equal(model.maxMinutes, 0)
  assert.equal(cellForDate(model, '2026-08-05')?.activity, null)
  assert.equal(cellForDate(model, '2026-08-05')?.level, 0)
  assert.equal(cellForDate(model, '2026-08-06')?.activity, null)
  assert.equal(cellForDate(model, '2026-08-06')?.level, 0)
})

test('monthly calendar summary renders active days from the calendar model', () => {
  assert.equal(monthlyWatchCalendarSource.includes('model.activeDays'), true)
  assert.equal(monthlyWatchCalendarSource.includes('stats.activeDays'), true)
})

test('monthly calendar description interpolates the selected month label', () => {
  assert.equal(monthlyWatchCalendarSource.includes('formatProfileMonth'), true)
  assert.equal(monthlyWatchCalendarSource.includes('watchCalendarDescription'), true)
  assert.match(monthlyWatchCalendarSource, /month:\s*monthLabel/)
})

test('date-only keys remain stable across local timezone parsing', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [day('2026-08-01', { minutes: 60 })],
  })

  assert.equal(cellForDate(model, '2026-08-01')?.activity?.minutes, 60)
  assert.equal(cellForDate(model, '2026-07-31')?.activity, null)
})

test('intensity scales monthly magnitude so skewed low values stay low', () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day('2026-08-01', { minutes: 1 }),
      day('2026-08-02', { minutes: 2 }),
      day('2026-08-03', { minutes: 1000 }),
      day('2026-08-05', { minutes: 0 }),
    ],
  })

  assert.equal(model.maxMinutes, 1000)
  assert.equal(cellForDate(model, '2026-08-01')?.level, 1)
  assert.equal(cellForDate(model, '2026-08-02')?.level, 1)
  assert.equal(cellForDate(model, '2026-08-03')?.level, 4)
  assert.equal(cellForDate(model, '2026-08-05')?.level, 0)
})
