'use client'

import type { TMDbTitle } from '@kino/core'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { useMediaPoster } from '@/hooks/title/use-media-poster'
import { cn } from '@/lib/utils'
import { MediaRow } from './media-row'

type MediaSectionProps = {
  title: string
  items: TMDbTitle[]
  density?: 'default' | 'comfortable'
}

export function MediaSection({ title, items, density = 'default' }: MediaSectionProps) {
  if (items.length === 0) return null

  return (
    <section className={cn(density === 'comfortable' ? 'mb-12 lg:mb-14' : 'mb-10')}>
      <div
        className={cn(
          'flex items-center justify-between',
          density === 'comfortable' ? 'mb-5' : 'mb-4'
        )}
      >
        <h2
          className={cn(
            'font-semibold text-kino-text',
            density === 'comfortable' ? 'text-xl lg:text-2xl' : 'text-xl'
          )}
        >
          {title}
        </h2>
      </div>

      <MediaRow className={density === 'comfortable' ? 'media-row--comfortable' : undefined}>
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
      <Poster
        className="w-full rounded-md"
        details={{ year }}
        sizes="156px"
        src={poster}
        title={title}
      />
    </Link>
  )
}
