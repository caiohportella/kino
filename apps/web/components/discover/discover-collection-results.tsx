'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ActiveDiscoverCollection } from '@/components/discover/active-discover-collection'
import { Poster } from '@/components/kino'
import { MediaRow } from '@/components/media/media-row'
import { useMediaPoster } from '@/hooks/title/use-media-poster'
import {
  type ResolvedDiscoverCollectionGroup,
  resolveDiscoverCollection,
  resolveDiscoverCollectionHero,
} from '@/lib/discover/collection-resolver'
import type { DiscoverCollection } from '@/lib/discover/collections'
import { useTranslation } from '@/lib/localization/i18n'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

export function DiscoverCollectionResults({
  collection,
  onClearAction,
}: {
  collection: DiscoverCollection
  onClearAction: () => void
}) {
  const { t } = useTranslation()

  const language = useSettingsStore((state) => state.language)

  /*
   * Resolve the hero separately so a cached collection
   * card can paint the cinematic header immediately,
   * without waiting for every dynamic franchise source.
   */
  const heroQuery = useQuery({
    queryKey: [
      'discover-collection-hero',
      collection.id,
      collection.hero.type,
      collection.hero.tmdbId,
      language,
    ],

    queryFn: async () => {
      const tmdb = getTmdb()

      tmdb.setLanguage(language)

      return resolveDiscoverCollectionHero({
        tmdb,
        collection,
      })
    },

    staleTime: 30 * 60 * 1000,
  })

  const collectionQuery = useQuery({
    queryKey: ['discover-franchise-collection', collection.id, language],

    queryFn: async () => {
      const tmdb = getTmdb()

      tmdb.setLanguage(language)

      return resolveDiscoverCollection({
        tmdb,
        collection,
      })
    },
  })

  const data = collectionQuery.data

  const hero = data?.hero ?? heroQuery.data ?? null

  const groups = data?.groups ?? []

  return (
    <div className="w-full min-w-0 max-w-full">
      <ActiveDiscoverCollection collection={collection} hero={hero} onClearAction={onClearAction} />

      <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
        {collectionQuery.isLoading ? <CollectionRowsSkeleton /> : null}

        {collectionQuery.isError ? (
          <div className="py-16 text-center text-sm text-kino-muted">
            {t('common.failed', {
              defaultValue: 'Something went wrong',
            })}
          </div>
        ) : null}

        {groups.map((group) => (
          <CollectionMediaSection group={group} key={group.id} />
        ))}
      </div>
    </div>
  )
}

function CollectionMediaSection({ group }: { group: ResolvedDiscoverCollectionGroup }) {
  const { t } = useTranslation()

  const title = t(group.titleKey, {
    defaultValue: group.titleDefault,
  })

  return (
    <section className="min-w-0 scroll-mt-24" id={`collection-group-${group.id}`}>
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-kino-text sm:text-[1.35rem]">
        {title}
      </h2>

      <MediaRow aria-label={title} overflowAware>
        {group.items.map((item) => (
          <CollectionMediaItem item={item} key={`${item.media_type}-${item.id}`} />
        ))}
      </MediaRow>
    </section>
  )
}

function CollectionMediaItem({ item }: { item: ResolvedDiscoverCollectionGroup['items'][number] }) {
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
        className="w-full rounded-lg transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)] group-hover:ring-1 group-hover:ring-kino-accent/70"
        details={{
          year,
        }}
        src={poster}
        title={title}
      />
    </Link>
  )
}

function CollectionRowsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-12">
      {Array.from({
        length: 2,
      }).map((_, rowIndex) => (
        <section key={rowIndex}>
          <div className="mb-4 h-6 w-44 animate-pulse rounded bg-white/6" />

          <MediaRow>
            {Array.from({
              length: 7,
            }).map((_, itemIndex) => (
              <div className="min-w-0" key={itemIndex}>
                <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-white/6" />
              </div>
            ))}
          </MediaRow>
        </section>
      ))}
    </div>
  )
}
