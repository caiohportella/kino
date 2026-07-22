'use client'

import type { TMDbTitle } from '@kino/core'
import { getDisplayTitle, getReleaseYear } from '@kino/core'
import { Poster } from '@/components/kino'
import Link from 'next/link'
import type { Ref } from 'react'
import { titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'

export function MediaCard({
  active,
  id,
  item,
  linkRef,
  role,
}: {
  active?: boolean
  id?: string
  item: TMDbTitle
  linkRef?: Ref<HTMLAnchorElement>
  role?: string
}) {
  const tmdb = getTmdb()
  const title = getDisplayTitle(item)
  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  const year = getReleaseYear(item)
  const poster = tmdb.getImageUrl(item.poster_path, 'w300')

  return (
    <Link
      aria-selected={active}
      className={cn(
        'group grid min-w-0 gap-3 focus-ring',
        active && 'rounded-md ring-2 ring-kino-accent/40'
      )}
      href={titlePath(item.id, title, type)}
      id={id}
      ref={linkRef}
      role={role}
    >
      <Poster className="w-full rounded-md" src={poster} title={title} />
      <div className="min-w-0">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text group-hover:text-kino-accent">
          {title}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-kino-muted">
          <span className="min-w-0 truncate">
            {year || 'TBA'} - {type === 'tv' ? 'Series' : 'Movie'}
          </span>
          <span>{item.vote_average ? item.vote_average.toFixed(1) : 'New'}</span>
        </div>
      </div>
    </Link>
  )
}
