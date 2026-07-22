'use client'

import type { ReactElement } from 'react'
import type { Locale } from 'react-day-picker'
import { AdvancedCalendar } from '@/components/ui/advanced-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function SingleDatePicker({
  disabled,
  endMonth,
  locale,
  onOpenChange,
  onSelect,
  open,
  selected,
  startMonth,
  trigger,
}: {
  disabled?: boolean
  endMonth: Date
  locale?: Partial<Locale>
  onOpenChange: (open: boolean) => void
  onSelect: (date: Date) => void
  open: boolean
  selected: Date
  startMonth: Date
  trigger: ReactElement
}) {
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger disabled={disabled} render={trigger} />
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <AdvancedCalendar
          autoFocus
          disabled={{ after: endMonth, before: startMonth }}
          endMonth={endMonth}
          locale={locale}
          mode="single"
          onSelect={(date) => { if (date) onSelect(date) }}
          selected={selected}
          startMonth={startMonth}
        />
      </PopoverContent>
    </Popover>
  )
}
