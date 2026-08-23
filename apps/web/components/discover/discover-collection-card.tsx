'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import { resolveDiscoverCollectionHero } from '@/lib/discover/collection-resolver'
import type { DiscoverCollection, DiscoverCollectionId } from '@/lib/discover/collections'
import { getDiscoverCollectionTitle } from '@/lib/discover/discover-localization'
import { useTranslation } from '@/lib/localization/i18n'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

export function DiscoverCollectionCard({
  collection,
  href,
  onSelectAction,
}: {
  collection: DiscoverCollection
  href: string
  onSelectAction: (id: DiscoverCollectionId) => void
}) {
  const { t } = useTranslation()

  const language = useSettingsStore((state) => state.language)

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

      const hero = await resolveDiscoverCollectionHero({
        tmdb,
        collection,
      })

      if (!hero?.backdrop_path) {
        return null
      }

      return tmdb.getBackdropUrl(hero.backdrop_path, 'w780')
    },

    staleTime: 30 * 60 * 1000,
  })

  const title = getDiscoverCollectionTitle(t, collection)

  return (
    <Link
      aria-label={title}
      className="
        group focus-ring relative block
        aspect-video min-w-0
        overflow-hidden rounded-md
        border border-white/10
        bg-white/4

        transition-[border-color,box-shadow]
        duration-300

        hover:border-kino-accent/30
        hover:shadow-xl

        focus-visible:border-kino-accent/30
      "
      href={href}
      onClick={(event) => {
        if (event.defaultPrevented || isModifiedEvent(event)) {
          return
        }

        event.preventDefault()
        onSelectAction(collection.id)
      }}
    >
      {heroQuery.data ? (
        <img
          alt=""
          aria-hidden="true"
          className="
            absolute inset-0 size-full
            object-cover

            transition-transform
            duration-500 ease-out

            group-hover:scale-[1.05]
            group-focus-within:scale-[1.05]

            motion-reduce:transform-none
            motion-reduce:transition-none
          "
          src={heroQuery.data}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/5" />
      )}

      <div
        aria-hidden="true"
        className="
          absolute inset-0
          bg-linear-to-t
          from-black/90
          via-black/25
          to-transparent

          transition-opacity duration-300
          group-hover:opacity-100
          group-focus-within:opacity-100
        "
      />

      <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
        <div
          className="
            mb-2 h-0.5 w-8
            origin-left scale-x-0
            rounded-full bg-kino-accent

            transition-transform duration-300 ease-out

            group-hover:scale-x-100
            group-focus-within:scale-x-100

            motion-reduce:scale-x-100
            motion-reduce:transition-none
          "
        />

        <h3
          className="
            line-clamp-2
            text-base font-semibold
            leading-tight text-white
            sm:text-lg
          "
        >
          {title}
        </h3>
      </div>
    </Link>
  )
}
