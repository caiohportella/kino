'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function HeroStat({
  icon: Icon,
  label,
  locale,
  onClick,
  value,
}: {
  icon?: LucideIcon
  label: string
  locale?: string
  onClick?: () => void
  value: string | number
}) {
  const formattedValue =
    typeof value === 'number' && locale ? new Intl.NumberFormat(locale).format(value) : value

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-kino-text">{formattedValue}</div>

        {Icon ? <Icon aria-hidden="true" className="shrink-0 text-kino-muted" size={18} /> : null}
      </div>

      <div
        className="
          mt-3
          text-[11px] font-semibold
          uppercase leading-4
          tracking-[0.06em]
          text-kino-muted
        "
      >
        {label}
      </div>
    </>
  )

  const className = cn(
    `
      flex min-h-28 min-w-0
      flex-col justify-center
      rounded-md
      border border-white/10
      bg-white/[0.035]
      p-4
      text-left

      sm:p-5
    `,
    onClick &&
      `
        cursor-pointer
        transition-[background-color,border-color]
        duration-200

        hover:border-white/15
        hover:bg-white/[0.055]

        focus-ring
      `
  )

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
