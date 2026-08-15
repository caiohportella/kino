'use client'

import { cn } from '@/lib/utils'

export type WatchlistProgressFilter = 'all' | 'watched' | 'to-watch'

interface WatchlistProgressProps {
  filter: WatchlistProgressFilter
  onFilterChange: (filter: WatchlistProgressFilter) => void
  percentage: number
  total: number
  watched: number
  toWatch: number
}

export function WatchlistProgress({
  filter,
  onFilterChange,
  percentage,
  total,
  watched,
  toWatch,
}: WatchlistProgressProps) {
  return (
    <section className="mb-8 flex flex-col gap-5 rounded-xl border border-white/8 bg-white/2.5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-kino-muted">Progress</p>

        <p className="mt-1 text-xl font-semibold text-kino-text">
          <span className="text-kino-accent">{watched}</span> of {total} watched
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <ProgressFilterButton active={filter === 'all'} onClick={() => onFilterChange('all')}>
            All {total}
          </ProgressFilterButton>

          <ProgressFilterButton
            active={filter === 'watched'}
            onClick={() => onFilterChange('watched')}
            tone="accent"
          >
            Watched {watched}
          </ProgressFilterButton>

          <ProgressFilterButton
            active={filter === 'to-watch'}
            onClick={() => onFilterChange('to-watch')}
          >
            To watch {toWatch}
          </ProgressFilterButton>
        </div>
      </div>

      <ProgressCircle percentage={percentage} />
    </section>
  )
}

function ProgressFilterButton({
  active,
  children,
  onClick,
  tone = 'default',
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'accent'
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? tone === 'accent'
            ? 'border-kino-accent/30 bg-kino-accent/15 text-kino-accent'
            : 'border-white/20 bg-white/8 text-kino-text'
          : 'border-transparent bg-white/[0.035] text-kino-muted hover:bg-white/6 hover:text-kino-text'
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function ProgressCircle({ percentage }: { percentage: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const progress = circumference * (1 - percentage / 100)

  return (
    <div
      aria-label={`${percentage}% watched`}
      className="relative grid h-14 w-14 shrink-0 place-items-center"
      role="img"
    >
      <svg aria-hidden="true" className="-rotate-90" height="56" viewBox="0 0 56 56" width="56">
        <circle
          className="stroke-white/10"
          cx="28"
          cy="28"
          fill="none"
          r={radius}
          strokeWidth="5"
        />

        <circle
          className="stroke-kino-accent transition-[stroke-dashoffset] duration-300"
          cx="28"
          cy="28"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>

      <span className="absolute text-xs font-bold text-kino-text">{percentage}%</span>
    </div>
  )
}
