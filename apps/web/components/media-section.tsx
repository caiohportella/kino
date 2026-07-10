import type { TMDbTitle } from '@kino/core'
import { MediaCard } from './media-card'
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
          <MediaCard item={item} key={`${item.media_type}-${item.id}`} />
        ))}
      </MediaRow>
    </section>
  )
}
