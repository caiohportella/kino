import type { ProfileRatedTitleStat } from '@kino/core'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RatedTitle = {
  title: string
  rating: number | null
}

type SharedProps = {
  title: string
  description: string
  highestRatedLabel: string
  lowestRatedLabel: string
  emptyLabel: string
  movieLabel: string
  seriesLabel: string
}

type OverallHighsAndLowsProps = SharedProps & {
  highestRated: RatedTitle | null
  lowestRated: RatedTitle | null

  highestRatedMovie?: never
  lowestRatedMovie?: never
  highestRatedSeries?: never
  lowestRatedSeries?: never
}

type MediaHighsAndLowsProps = SharedProps & {
  highestRatedMovie: ProfileRatedTitleStat | null
  lowestRatedMovie: ProfileRatedTitleStat | null
  highestRatedSeries: ProfileRatedTitleStat | null
  lowestRatedSeries: ProfileRatedTitleStat | null

  highestRated?: never
  lowestRated?: never
}

type HighsAndLowsCardProps = OverallHighsAndLowsProps | MediaHighsAndLowsProps

function isMediaHighsAndLows(props: HighsAndLowsCardProps): props is MediaHighsAndLowsProps {
  return 'highestRatedMovie' in props
}

export function HighsAndLowsCard(props: HighsAndLowsCardProps) {
  const {
    title,
    description,
    highestRatedLabel,
    lowestRatedLabel,
    emptyLabel,
    movieLabel,
    seriesLabel,
  } = props

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="px-6 pt-6">
        <CardTitle>{title}</CardTitle>

        <p className="text-xs text-kino-muted">{description}</p>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-4">
        {isMediaHighsAndLows(props) ? (
          <div className="grid gap-5">
            <RatedMediaGroup
              emptyLabel={emptyLabel}
              highestRated={props.highestRatedMovie}
              highestRatedLabel={highestRatedLabel}
              label={movieLabel}
              lowestRated={props.lowestRatedMovie}
              lowestRatedLabel={lowestRatedLabel}
            />

            <RatedMediaGroup
              emptyLabel={emptyLabel}
              highestRated={props.highestRatedSeries}
              highestRatedLabel={highestRatedLabel}
              label={seriesLabel}
              lowestRated={props.lowestRatedSeries}
              lowestRatedLabel={lowestRatedLabel}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <RatedTitleStatCard
              emptyLabel={emptyLabel}
              label={highestRatedLabel}
              title={props.highestRated}
              variant="high"
            />

            <RatedTitleStatCard
              emptyLabel={emptyLabel}
              label={lowestRatedLabel}
              title={props.lowestRated}
              variant="low"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RatedMediaGroup({
  label,
  highestRated,
  lowestRated,
  highestRatedLabel,
  lowestRatedLabel,
  emptyLabel,
}: {
  label: string
  highestRated: ProfileRatedTitleStat | null
  lowestRated: ProfileRatedTitleStat | null
  highestRatedLabel: string
  lowestRatedLabel: string
  emptyLabel: string
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold text-kino-text">{label}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <RatedTitleStatCard
          emptyLabel={emptyLabel}
          label={highestRatedLabel}
          title={highestRated}
          variant="high"
        />

        <RatedTitleStatCard
          emptyLabel={emptyLabel}
          label={lowestRatedLabel}
          title={lowestRated}
          variant="low"
        />
      </div>
    </div>
  )
}

function RatedTitleStatCard({
  title,
  label,
  emptyLabel,
  variant,
}: {
  title: RatedTitle | null
  label: string
  emptyLabel: string
  variant: 'high' | 'low'
}) {
  return (
    <div
      className={
        variant === 'high'
          ? 'min-w-0 rounded-[10px] border border-kino-accent/25 bg-kino-accent/[0.07] p-4'
          : 'min-w-0 rounded-[10px] border border-white/10 bg-white/25 p-4'
      }
    >
      <p
        className={
          variant === 'high'
            ? 'text-[11px] font-bold uppercase tracking-[0.08em] text-kino-accent'
            : 'text-[11px] font-bold uppercase tracking-[0.08em] text-kino-muted'
        }
      >
        {label}
      </p>

      {title ? (
        <>
          <p className="mt-2 truncate text-sm font-bold text-kino-text">{title.title}</p>

          <p className="mt-1 text-xs text-kino-muted">{formatRating(title.rating)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-kino-muted">{emptyLabel}</p>
      )}
    </div>
  )
}

function formatRating(rating: number | null) {
  if (rating == null) return '—'

  return `${Number.isInteger(rating) ? rating : rating.toFixed(2).replace(/0$/, '')}★`
}
