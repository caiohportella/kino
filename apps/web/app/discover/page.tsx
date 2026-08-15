import Link from 'next/link'

import { TrendingCarousel } from '@/components/carousel/trending-carousel'
import { DiscoverClient } from '@/components/discover/discover-client'
import { DiscoverFilters } from '@/components/discover/discover-filters'
import { EmptyState } from '@/components/kino'
import { PageHeader } from '@/components/layout/page-header'
import { MediaSection } from '@/components/media/media-section'
import { buttonVariants } from '@/components/ui/button'
import { getRequestLanguage, getTranslations } from '@/lib/server-localization'
import { getDiscoverData, getRegionForLanguage } from '@/lib/server-tmdb'
import { cn } from '@/lib/utils'

export default async function DiscoverPage() {
  const language = await getRequestLanguage()
  const t = await getTranslations(language)

  try {
    const data = await getDiscoverData(language, getRegionForLanguage(language))

    return (
      <div className="content-frame">
        <PageHeader title={t('tabs.home')} />

        <DiscoverClient
          genres={data.genres}
          movieGenres={data.movieGenres}
          tvGenres={data.tvGenres}
          trending={data.trending}
          popularMovies={data.popularMovies}
          popularTV={data.popularTV}
          nowPlaying={data.nowPlaying}
          topRated={data.topRated}
          upcoming={data.upcoming}
        />
      </div>
    )
  } catch (error) {
    return (
      <EmptyState
        action={
          <Link className={cn(buttonVariants({ variant: 'secondary' }))} href="/discover">
            {t('common.tryAgain')}
          </Link>
        }
        body={error instanceof Error ? error.message : 'TMDB did not respond.'}
        illustrationLabel={t('emptyStates.missingIllustration')}
        title={t('common.failed')}
        variant="missing"
      />
    )
  }
}
