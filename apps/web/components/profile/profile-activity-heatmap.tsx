'use client'

import { useEffect, useRef, useState } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import type { HeatmapDatum } from '@/components/ui/heatmap-calendar'
import { useTranslation } from '@/lib/i18n'

type ProfileActivityCalendarProps = {
  data: HeatmapDatum[]
  endDate?: Date
  rangeDays?: number
}

export const PROFILE_ACTIVITY_LEVEL_COLORS = [
  '#262626',
  '#145c32',
  '#17833f',
  '#1aa34a',
  '#1db954',
] as const

function activityLevel(value: number) {
  if (value <= 0) return 0
  if (value <= 2) return 1
  if (value <= 5) return 2
  if (value <= 10) return 3
  return 4
}

function formatDate(value: string | Date) {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-')
  }

  return value.slice(0, 10)
}

function formatTooltipDate(value: string, locale: string) {
  const [yearText, monthText, dayText] = value.split('-')

  if (!yearText || !monthText || !dayText) {
    return value
  }

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function ProfileActivityHeatmap({
  data,
  endDate = new Date(),
  rangeDays = 365,
}: ProfileActivityCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [blockSize, setBlockSize] = useState(12)

  const { t, i18n } = useTranslation()

  const monthLabels = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
    }).format(new Date(2024, month, 1))
  )

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const start = new Date(end)
  start.setDate(start.getDate() - (rangeDays - 1))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateBlockSize = () => {
      const width = container.clientWidth

      const startWeekdayOffset = (start.getDay() - 1 + 7) % 7
      const weekCount = Math.ceil((rangeDays + startWeekdayOffset) / 7)

      const blockMargin = 2
      const availableWidth = width
      const gapsWidth = (weekCount - 1) * blockMargin

      const nextBlockSize = Math.max(8, Math.floor((availableWidth - gapsWidth) / weekCount))

      setBlockSize(nextBlockSize)
    }

    updateBlockSize()

    const observer = new ResizeObserver(updateBlockSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [rangeDays, start])

  const activityByDate = new Map(data.map((item) => [formatDate(item.date), item.value]))

  const startKey = formatDate(start)
  const endKey = formatDate(end)

  const activities = [
    {
      date: startKey,
      count: activityByDate.get(startKey) ?? 0,
      level: activityLevel(activityByDate.get(startKey) ?? 0),
    },
    ...data
      .map((item) => {
        const count = item.value

        return {
          date: formatDate(item.date),
          count,
          level: activityLevel(count),
        }
      })
      .filter(({ date }) => date >= startKey && date <= endKey)
      .filter(({ date }) => date !== startKey && date !== endKey),
    {
      date: endKey,
      count: activityByDate.get(endKey) ?? 0,
      level: activityLevel(activityByDate.get(endKey) ?? 0),
    },
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <ActivityCalendar
        data={activities}
        blockMargin={2}
        blockRadius={3}
        blockSize={blockSize}
        colorScheme="dark"
        showColorLegend={false}
        tooltips={{
          activity: {
            withArrow: true,
            text: (activity) =>
              t('stats.activityTooltip', {
                count: activity.count,
                date: formatTooltipDate(activity.date, i18n.language),
              }),
          },
        }}
        labels={{
          months: monthLabels,
        }}
        showMonthLabels
        showTotalCount={false}
        showWeekdayLabels={false}
        theme={{
          dark: [...PROFILE_ACTIVITY_LEVEL_COLORS],
          light: [...PROFILE_ACTIVITY_LEVEL_COLORS],
        }}
        weekStart={1}
      />
    </div>
  )
}
