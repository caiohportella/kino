'use client'

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ComponentProps } from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = ComponentProps<typeof DayPicker>

export function Calendar({
  captionLayout = 'label',
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn('kino-calendar', className)}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('relative flex w-full flex-col gap-3', defaultClassNames.month),
        month_caption: cn(
          'flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]',
          defaultClassNames.month_caption
        ),
        caption_label: cn('select-none text-base font-semibold text-kino-text', defaultClassNames.caption_label),
        nav: cn(
          'absolute inset-x-0 top-0 flex h-[var(--cell-size)] w-full items-center justify-between gap-2',
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ size: 'icon', variant: 'ghost' }),
          'h-[var(--cell-size)] w-[var(--cell-size)] rounded-md p-0 text-kino-text',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ size: 'icon', variant: 'ghost' }),
          'h-[var(--cell-size)] w-[var(--cell-size)] rounded-md p-0 text-kino-text',
          defaultClassNames.button_next
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex w-full', defaultClassNames.weekdays),
        weekday: cn('flex-1 select-none text-center text-xs font-semibold text-kino-muted', defaultClassNames.weekday),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        day: cn('relative aspect-square h-full flex-1 p-0 text-center select-none', defaultClassNames.day),
        day_button: cn(
          'grid h-[var(--cell-size)] w-full place-items-center rounded-md border border-transparent p-0 text-sm font-semibold text-kino-text outline-none transition-[background,border-color,color,transform,box-shadow] duration-150',
          defaultClassNames.day_button
        ),
        selected: cn(defaultClassNames.selected),
        today: cn(defaultClassNames.today),
        outside: cn(defaultClassNames.outside),
        disabled: cn(defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...iconProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : orientation === 'right' ? ChevronRight : ChevronDown

          return <Icon aria-hidden="true" className={cn('h-4 w-4', className)} {...iconProps} />
        },
        ...components,
      }}
      fixedWeeks
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}
