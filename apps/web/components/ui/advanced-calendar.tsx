'use client'

import { differenceInCalendarDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import {
  DayPicker,
  type DayPickerProps,
  labelNext,
  labelPrevious,
  useDayPicker,
} from 'react-day-picker'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CalendarView = 'days' | 'years'

export type AdvancedCalendarProps = DayPickerProps & {
  yearRange?: number
}

function AdvancedCalendar({
  className,
  components,
  numberOfMonths,
  showOutsideDays = true,
  yearRange = 12,
  ...props
}: AdvancedCalendarProps) {
  const [view, setView] = React.useState<CalendarView>('days')
  const [displayYears, setDisplayYears] = React.useState(() => {
    const currentYear = new Date().getFullYear()
    return {
      from: currentYear - Math.floor(yearRange / 2 - 1),
      to: currentYear + Math.ceil(yearRange / 2),
    }
  })

  return (
    <DayPicker
      className={cn('w-70 max-w-full p-3', className)}
      classNames={{
        months: 'relative flex',
        month: 'w-full',
        month_caption: 'relative mx-9 flex h-8 items-center justify-center',
        caption_label: 'truncate text-sm font-semibold',
        nav: 'flex items-start',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute inset-s-0 top-0 opacity-80 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute inset-e-0 top-0 opacity-80 hover:opacity-100'
        ),
        month_grid: 'mx-auto mt-3 w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex-1 text-center text-xs font-semibold text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative flex aspect-square flex-1 items-center justify-center p-0 text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 rounded-md p-0 font-normal aria-selected:opacity-100'
        ),
        selected:
          '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary/80',
        today: '[&>button]:bg-muted [&>button]:text-foreground',
        outside: 'text-muted-foreground opacity-40',
        disabled: 'text-muted-foreground opacity-40',
        hidden: 'invisible',
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft /> : <ChevronRight />),
        CaptionLabel: (captionProps) => (
          <Button
            className="h-8 w-full truncate px-2 text-sm"
            onClick={() => setView((current) => (current === 'days' ? 'years' : 'days'))}
            size="sm"
            type="button"
            variant="ghost"
          >
            {view === 'days' ? captionProps.children : `${displayYears.from} – ${displayYears.to}`}
          </Button>
        ),
        Nav: ({ className: navClassName }) => (
          <CalendarNav
            className={navClassName}
            displayYears={displayYears}
            endMonth={props.endMonth}
            onDisplayYearsChange={setDisplayYears}
            startMonth={props.startMonth}
            view={view}
          />
        ),
        MonthGrid: ({ children, className: gridClassName, ...gridProps }) =>
          view === 'years' ? (
            <YearGrid
              className={gridClassName}
              displayYears={displayYears}
              endMonth={props.endMonth}
              onSelectYear={() => setView('days')}
              startMonth={props.startMonth}
            />
          ) : (
            <table className={gridClassName} {...gridProps}>
              {children}
            </table>
          ),
        ...components,
      }}
      numberOfMonths={view === 'years' ? 1 : numberOfMonths}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}

function CalendarNav({
  className,
  displayYears,
  endMonth,
  onDisplayYearsChange,
  startMonth,
  view,
}: {
  className?: string
  displayYears: { from: number; to: number }
  endMonth?: Date
  onDisplayYearsChange: React.Dispatch<React.SetStateAction<{ from: number; to: number }>>
  startMonth?: Date
  view: CalendarView
}) {
  const { goToMonth, nextMonth, previousMonth } = useDayPicker()
  const span = displayYears.to - displayYears.from + 1
  const previousDisabled =
    view === 'years'
      ? Boolean(startMonth && displayYears.from <= startMonth.getFullYear())
      : !previousMonth

  const nextDisabled =
    view === 'years' ? Boolean(endMonth && displayYears.to >= endMonth.getFullYear()) : !nextMonth

  return (
    <nav className={cn('flex items-center', className)}>
      <Button
        aria-label={
          view === 'years' ? `Go to the previous ${span} years` : labelPrevious(previousMonth)
        }
        className="absolute inset-s-0 top-0"
        disabled={previousDisabled}
        onClick={() => {
          if (view === 'years') {
            onDisplayYearsChange((current) => {
              const minimumYear = startMonth?.getFullYear()
              const nextFrom = current.from - span

              if (minimumYear !== undefined && nextFrom < minimumYear) {
                return {
                  from: minimumYear,
                  to: minimumYear + span - 1,
                }
              }

              return {
                from: nextFrom,
                to: current.to - span,
              }
            })
          } else if (previousMonth) {
            goToMonth(previousMonth)
          }
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <ChevronLeft />
      </Button>
      <Button
        aria-label={view === 'years' ? `Go to the next ${span} years` : labelNext(nextMonth)}
        className="absolute inset-e-0 top-0"
        disabled={nextDisabled}
        onClick={() => {
          if (view === 'years') {
            onDisplayYearsChange((current) => {
              const maximumYear = endMonth?.getFullYear()
              const nextTo = current.to + span

              if (maximumYear !== undefined && nextTo > maximumYear) {
                return {
                  from: maximumYear - span + 1,
                  to: maximumYear,
                }
              }

              return {
                from: current.from + span,
                to: nextTo,
              }
            })
          } else if (nextMonth) {
            goToMonth(nextMonth)
          }
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}

function YearGrid({
  className,
  displayYears,
  endMonth,
  onSelectYear,
  startMonth,
}: {
  className?: string
  displayYears: { from: number; to: number }
  endMonth?: Date
  onSelectYear: () => void
  startMonth?: Date
}) {
  const { goToMonth, selected } = useDayPicker()
  return (
    <div className={cn('grid min-h-56 grid-cols-4 content-center gap-2', className)}>
      {Array.from({ length: displayYears.to - displayYears.from + 1 }, (_, index) => {
        const year = displayYears.from + index
        const disabled = Boolean(
          (startMonth && differenceInCalendarDays(new Date(year, 11, 31), startMonth) < 0) ||
            (endMonth && differenceInCalendarDays(new Date(year, 0, 1), endMonth) > 0)
        )
        return (
          <Button
            className={cn(year === new Date().getFullYear() && 'bg-muted')}
            disabled={disabled}
            key={year}
            onClick={() => {
              goToMonth(new Date(year, (selected as Date | undefined)?.getMonth() ?? 0))
              onSelectYear()
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {year}
          </Button>
        )
      })}
    </div>
  )
}

export { AdvancedCalendar }
