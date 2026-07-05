'use client'

import type { TMDbTitle } from '@kino/core'
import { getDisplayTitle, getReleaseYear } from '@kino/core'
import { Poster } from '@kino/ui'
import Link from 'next/link'
import { getTmdb } from '@/lib/services'

export function MediaCard({ item }: { item: TMDbTitle }) {
  const tmdb = getTmdb()
  const title = getDisplayTitle(item)
  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  const year = getReleaseYear(item)
  const poster = tmdb.getImageUrl(item.poster_path, 'w300')

  return (
    <Link className="group grid min-w-0 gap-3 focus-ring" href={`/title/${item.id}?type=${type}`}>
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
