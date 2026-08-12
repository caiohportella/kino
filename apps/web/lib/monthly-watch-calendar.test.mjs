import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlyWatchCalendar } from "./monthly-watch-calendar.ts";

function day(date, overrides = {}) {
  return {
    date,
    entries: 1,
    moviesWatched: 1,
    episodesWatched: 0,
    minutes: 10,
    ...overrides,
  };
}

function cellForDate(model, date) {
  for (const week of model.weeks) {
    for (const cell of week) {
      if (cell.date === date) {
        return cell;
      }
    }
  }
  return null;
}

test("August 2026 starts with five leading Monday-first slots and ignores September activity", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-01", { minutes: 30 }),
      day("2026-08-31", { minutes: 45 }),
      day("2026-09-01", { minutes: 999 }),
    ],
  });

  assert.equal(model.weeks.length, 6);
  assert.equal(model.weeks.every((week) => week.length === 7), true);
  assert.equal(model.weeks[0].slice(0, 5).every((cell) => cell.inMonth === false), true);
  assert.equal(model.weeks[0][5].date, "2026-08-01");
  assert.equal(model.weeks[0][5].inMonth, true);
  assert.equal(model.weeks[0][5].activity?.minutes, 30);

  const septemberCell = cellForDate(model, "2026-09-01");
  assert.ok(septemberCell);
  assert.equal(septemberCell.inMonth, false);
  assert.equal(septemberCell.activity, null);
});

test("February 2024 leap month keeps the right positions and day count", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2024,
    month: 2,
    dailyActivity: [day("2024-02-29", { minutes: 55 })],
  });

  assert.equal(model.weeks.length, 5);
  assert.equal(model.weeks.flat().length, 35);
  assert.equal(cellForDate(model, "2024-02-01")?.inMonth, true);
  assert.equal(model.weeks[0][3].date, "2024-02-01");
  assert.equal(model.weeks[0][3].inMonth, true);
  assert.equal(model.weeks[4][3].date, "2024-02-29");
  assert.equal(model.weeks[4][3].inMonth, true);
});

test("active days and longest streak come from the same activity map", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-03"),
      day("2026-08-04"),
      day("2026-08-05"),
      day("2026-08-07"),
    ],
  });

  assert.equal(model.activeDays, 4);
  assert.equal(model.longestStreak, 3);
});

test("most active day breaks ties by earliest date", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-09", { minutes: 90 }),
      day("2026-08-08", { minutes: 90 }),
      day("2026-08-10", { minutes: 75 }),
    ],
  });

  assert.equal(model.mostActiveDay?.date, "2026-08-08");
});

test("biggest binge day prefers episode count, then minutes, then earliest date", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-11", { episodesWatched: 3, moviesWatched: 0, minutes: 50 }),
      day("2026-08-09", { episodesWatched: 3, moviesWatched: 0, minutes: 50 }),
      day("2026-08-10", { episodesWatched: 3, moviesWatched: 0, minutes: 40 }),
      day("2026-08-12", { episodesWatched: 4, moviesWatched: 0, minutes: 25 }),
    ],
  });

  assert.equal(model.biggestBingeDay?.date, "2026-08-12");
});

test("zero-minute active days and outside-month cells stay at level zero", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-05", { minutes: 0 }),
      day("2026-09-01", { minutes: 100 }),
    ],
  });

  assert.equal(cellForDate(model, "2026-08-05")?.level, 0);
  assert.equal(cellForDate(model, "2026-09-01")?.activity, null);
  assert.equal(cellForDate(model, "2026-09-01")?.level, 0);
});

test("date-only keys remain stable across local timezone parsing", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [day("2026-08-01", { minutes: 60 })],
  });

  assert.equal(cellForDate(model, "2026-08-01")?.activity?.minutes, 60);
  assert.equal(cellForDate(model, "2026-07-31")?.activity, null);
});

test("intensity scales the month into five levels with the top positive day at level four", () => {
  const model = buildMonthlyWatchCalendar({
    year: 2026,
    month: 8,
    dailyActivity: [
      day("2026-08-01", { minutes: 5 }),
      day("2026-08-02", { minutes: 10 }),
      day("2026-08-03", { minutes: 20 }),
      day("2026-08-04", { minutes: 80 }),
      day("2026-08-05", { minutes: 0 }),
    ],
  });

  assert.equal(model.maxMinutes, 80);
  assert.equal(cellForDate(model, "2026-08-01")?.level, 1);
  assert.equal(cellForDate(model, "2026-08-02")?.level, 2);
  assert.equal(cellForDate(model, "2026-08-03")?.level, 3);
  assert.equal(cellForDate(model, "2026-08-04")?.level, 4);
  assert.equal(cellForDate(model, "2026-08-05")?.level, 0);
});
