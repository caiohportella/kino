'use client'

import type { TMDbTitle } from '@kino/core'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { useMediaPoster } from '@/hooks/use-media-poster'
import { MediaRow } from './media-row'

export function MediaSection({ title, items }: { title: string; items: TMDbTitle[] }) {
  if (items.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-kino-text">{title}</h2>
      </div>

      <MediaRow>
        {items.map((item) => (
          <MediaSectionItem item={item} key={`${item.media_type}-${item.id}`} />
        ))}
      </MediaRow>
    </section>
  )
}

function MediaSectionItem({ item }: { item: TMDbTitle }) {
  const { href, poster, prefetch, title, year } = useMediaPoster(item)

  return (
    <Link
      className="group min-w-0 focus-ring"
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <Poster className="w-full rounded-md" details={{ year }} src={poster} title={title} />
    </Link>
  )
}
