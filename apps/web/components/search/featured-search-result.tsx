'use client'

import Link from 'next/link'
import { Poster } from '@/components/kino'
import { useTranslation } from '@/lib/localization/i18n'
import { titlePath } from '@/lib/routes'
import type { FeaturedTitleResult } from '@/lib/search/featured-title'
import { getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'

function extractYear(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})/u.exec(value)
  return match?.[1] ?? null
}

function formatSeasonCount(count: number | null): string | null {
  if (count === null || !Number.isFinite(count) || count <= 0) return null
  return `${count} season${count === 1 ? '' : 's'}`
}

function formatDateRange(
  startYear: number | string | null | undefined,
  end: string | null | undefined
): string | null {
  if (!startYear && !end) return null
  if (startYear && end) return `${startYear} - ${end}`
  if (startYear) return String(startYear)
  return null
}

function formatCast(cast: readonly string[] | undefined): string | null {
  if (!cast?.length) return null
  return cast.join(' • ')
}

export function FeaturedSearchResult({
  active,
  id,
  linkRef,
  onSelect,
  result,
}: {
  active: boolean
  id: string
  linkRef: (node: HTMLAnchorElement | null) => void
  onSelect: () => void
  result: FeaturedTitleResult
}) {
  const { t } = useTranslation()
  const mediaType = result.mediaType === 'tv' ? 'tv' : 'movie'
  const poster = result.imagePath
    ? (getTmdb().getImageUrl(result.imagePath, 'w300') ?? undefined)
    : undefined
  const seasonCount = formatSeasonCount(
    typeof result.media.number_of_seasons === 'number' ? result.media.number_of_seasons : null
  )
  const endYear = extractYear(result.media.last_air_date ?? null) // TV only, fine if undefined for movies
  const dateRange = formatDateRange(result.year, endYear)
  const cast = formatCast(result.media.cast)

  return (
    <Link
      aria-selected={active}
      className={cn(
        'group relative flex min-h-32 items-start gap-4 overflow-hidden rounded-xl border border-white/10',
        'bg-white/4 px-3 py-3 transition-colors hover:bg-white/6',
        active && 'bg-white/8 ring-1 ring-kino-accent/30'
      )}
      href={titlePath(result.media.id, result.name, mediaType)}
      id={id}
      onClick={onSelect}
      ref={linkRef}
      role="option"
    >
      <div className="relative w-16 shrink-0 overflow-hidden rounded-md sm:w-20 lg:w-24">
        <Poster alt={result.name} className="w-full rounded-md" src={poster} title={result.name} />
        {/* decorative hover cue only — the whole card is already the click target */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg className="h-6 w-6 drop-shadow" fill="white" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="rgba(255,255,255,0.15)"
              stroke="white"
              strokeWidth="1.2"
            />
            <path d="M10 8.5v7l6-3.5-6-3.5z" fill="white" />
          </svg>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-kino-accent/20 bg-kino-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-kino-accent">
            <svg
              className="h-2.5 w-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('search.bestMatch')}
          </span>
        </div>

        <h3 className="truncate text-base font-semibold tracking-tight text-kino-text group-hover:text-kino-accent">
          {result.name}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {seasonCount ? (
            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-kino-muted">
              {seasonCount}
            </span>
          ) : null}
          {dateRange ? (
            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-kino-muted">
              {dateRange}
            </span>
          ) : null}
          <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-kino-muted">
            {mediaType === 'tv' ? t('common.tv') : t('common.movie')}
          </span>
        </div>

        {result.media.overview ? (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-kino-muted sm:line-clamp-3">
            {result.media.overview}
          </p>
        ) : null}

        {cast ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-kino-muted sm:line-clamp-2">
            <span className="font-medium text-kino-text/80">{t('title.cast')} </span>
            {cast}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
