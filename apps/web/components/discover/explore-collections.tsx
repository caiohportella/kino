'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { MediaRow } from '@/components/media/media-row'
import { DISCOVER_COLLECTIONS, type DiscoverCollectionId } from '@/lib/discover/collections'
import {
  getDiscoverExploreCollectionsDescription,
  getDiscoverExploreCollectionsLabel,
} from '@/lib/discover/discover-localization'
import { writeDiscoverCollectionUrl } from '@/lib/discover/discover-url-state'
import { useTranslation } from '@/lib/localization/i18n'
import { DiscoverCollectionCard } from './discover-collection-card'

export function ExploreCollections({
  onSelectAction,
}: {
  onSelectAction: (id: DiscoverCollectionId) => void
}) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSearch =
    typeof window === 'undefined' ? searchParams.toString() : window.location.search
  const currentParams = new URLSearchParams(currentSearch)

  return (
    <section className="mb-12 border-t border-white/8 pt-7 lg:mb-14">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-kino-text">
          {getDiscoverExploreCollectionsLabel(t)}
        </h2>

        <p className="mt-1 text-sm text-kino-muted">
          {getDiscoverExploreCollectionsDescription(t)}
        </p>
      </div>

      <MediaRow className="media-row--collections px-0" overflowAware>
        {DISCOVER_COLLECTIONS.map((collection) => (
          <div key={collection.id}>
            <DiscoverCollectionCard
              collection={collection}
              href={(() => {
                const query = writeDiscoverCollectionUrl(currentParams, collection.id)

                return query ? `${pathname}?${query}` : pathname
              })()}
              onSelectAction={onSelectAction}
            />
          </div>
        ))}
      </MediaRow>
    </section>
  )
}
