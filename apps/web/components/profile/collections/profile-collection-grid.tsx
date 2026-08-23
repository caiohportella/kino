import Link from 'next/link'
import { Poster } from '@/components/kino'
import { Skeleton } from '@/components/ui/skeleton'
import { titlePath } from '@/lib/routes'

export type ProfileCollectionGridItem = {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterUrl: string | null
  year: number | null
}

export function ProfileCollectionGrid({ items }: { items: ProfileCollectionGridItem[] }) {
  return (
    <div
      className="
      grid grid-cols-2 gap-5
      sm:grid-cols-3
      md:grid-cols-4
      lg:grid-cols-6
      xl:grid-cols-8
      min-[1500px]:grid-cols-9
      min-[1900px]:grid-cols-12
    "
    >
      {items.map((item) => (
        <Link
          className="group min-w-0 focus-ring"
          href={titlePath(item.tmdbId, item.title, item.mediaType)}
          key={item.id}
        >
          <Poster
            className="w-full rounded-md"
            details={{
              year: item.year,
            }}
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 20vw, 16vw"
            src={item.posterUrl}
            title={item.title}
          />
        </Link>
      ))}
    </div>
  )
}

export function ProfileCollectionGridSkeleton({ count }: { count: number }) {
  return (
    <div
      aria-busy="true"
      className="
      grid grid-cols-2 gap-5
      sm:grid-cols-3
      md:grid-cols-4
      lg:grid-cols-6
      xl:grid-cols-8
      min-[1500px]:grid-cols-9
      min-[1900px]:grid-cols-12
      "
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="grid min-w-0 content-start gap-3" key={index}>
          <Skeleton className="aspect-2/3 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}
