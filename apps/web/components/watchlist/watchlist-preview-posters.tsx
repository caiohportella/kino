import type { WatchlistPreviewTitle } from '@kino/core'
import { Check } from 'lucide-react'
import { Poster } from '@/components/kino'

export function WatchlistPreviewPosters({ titles }: { titles: WatchlistPreviewTitle[] }) {
  if (titles.length === 0) {
    return null
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {titles.slice(0, 4).map((title) => (
        <div
          className="relative h-full min-w-0 flex-1 overflow-hidden [&>div]:h-full"
          key={title.id}
        >
          <Poster
            className="size-full rounded-none"
            interactive={false}
            src={title.coverImage}
            title={title.title}
          />

          {title.watched ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-kino-accent text-black shadow-md"
            >
              <Check strokeWidth={3} size={14} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
