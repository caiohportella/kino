import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

const heatmapSource = await readSource(
  "../components/profile/profile-activity-heatmap.tsx",
);

const statsPageSource = await readSource(
  "../components/profile/profile-stats-page.tsx",
);

const monthlyRecapSource = await readSource(
  "../components/profile/profile-monthly-recap-page.tsx",
);

const monthlyWatchCalendarSource = await readSource(
  "../components/profile/monthly-watch-calendar.tsx",
);

test("lifetime activity heatmap wraps react-activity-calendar", () => {
  assert.match(heatmapSource, /from ['"]react-activity-calendar['"]/);

  assert.equal(heatmapSource.includes("ActivityCalendar"), true);
});

test("lifetime statistics uses the dedicated activity heatmap", () => {
  assert.equal(statsPageSource.includes("ProfileActivityHeatmap"), true);
});

test("monthly recap uses the dedicated monthly watch calendar instead of the generic heatmap", () => {
  assert.equal(monthlyRecapSource.includes("MonthlyWatchCalendar"), true);
  assert.equal(monthlyRecapSource.includes("HeatmapCalendar"), false);
  assert.equal(monthlyWatchCalendarSource.includes("export function MonthlyWatchCalendar"), true);
});

test("lifetime activity heatmap sizes blocks from its container width", () => {
  assert.equal(heatmapSource.includes("ResizeObserver"), true);

  assert.equal(heatmapSource.includes("containerRef"), true);

  assert.equal(heatmapSource.includes("blockSize={blockSize}"), true);

  assert.equal(heatmapSource.includes("blockSize={12}"), false);
});

test("responsive heatmap attaches its resize ref to a full-width container", () => {
  assert.equal(heatmapSource.includes("ref={containerRef}"), true);

  assert.equal(heatmapSource.includes('className="w-full'), true);
});

test("lifetime heatmap clips data to its range and removes weekday labels", () => {
  assert.equal(
    heatmapSource.includes(
      ".filter(({ date }) => date >= startKey && date <= endKey)",
    ),
    true,
  );

  assert.equal(heatmapSource.includes("showWeekdayLabels={false}"), true);
});

test("lifetime heatmap delegates its legend to the activity card", () => {
  assert.equal(heatmapSource.includes("showColorLegend={false}"), true);

  assert.equal(statsPageSource.includes("ProfileActivityLegend"), true);

  assert.equal(statsPageSource.includes('t("stats.less")'), true);

  assert.equal(statsPageSource.includes('t("stats.more")'), true);
});

test("heatmap and header legend share the Kino green intensity scale", () => {
  assert.equal(heatmapSource.includes("PROFILE_ACTIVITY_LEVEL_COLORS"), true);

  assert.equal(heatmapSource.includes('"#1db954"'), true);

  assert.equal(heatmapSource.includes("blockMargin={2}"), true);

  assert.equal(
    statsPageSource.includes("PROFILE_ACTIVITY_LEVEL_COLORS.map"),
    true,
  );

  assert.equal(statsPageSource.includes("bg-white/10"), false);
});

test("lifetime statistics uses a wider frame for the activity heatmap", () => {
  assert.equal(
    statsPageSource.includes(
      'className="content-frame mx-auto w-full max-w-[76rem]"',
    ),
    true,
  );
});

test("lifetime heatmap shows localized month labels without weekday labels", () => {
  assert.equal(heatmapSource.includes("showMonthLabels"), true);

  assert.equal(heatmapSource.includes("showMonthLabels={false}"), false);

  assert.equal(heatmapSource.includes("showWeekdayLabels={false}"), true);

  assert.equal(heatmapSource.includes("labels={{"), true);

  assert.equal(heatmapSource.includes("months:"), true);
});

test("lifetime heatmap shows localized activity details on hover", () => {
  assert.equal(
    heatmapSource.includes("tooltips={{"),
    true,
  );

  assert.equal(
    heatmapSource.includes("activity: {"),
    true,
  );

  assert.equal(
    heatmapSource.includes('t("stats.activityTooltip"'),
    true,
  );

  assert.equal(
    heatmapSource.includes("Intl.DateTimeFormat"),
    true,
  );
});
