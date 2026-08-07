import Link from 'next/link'

import { TrendingCarousel } from '@/components/carousel/trending-carousel'
import { EmptyState } from '@/components/kino'
import { MediaSection } from '@/components/media-section'
import { PageHeader } from '@/components/page-header'
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

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-kino-text">{t('home.trending')}</h2>
          </div>
          <TrendingCarousel items={data.trending} />
        </section>
        <MediaSection items={data.popularMovies} title={t('home.popularMovies')} />
        <MediaSection items={data.popularTV} title={t('home.popularTV')} />
        <MediaSection items={data.nowPlaying} title={t('home.newReleases')} />
        <MediaSection items={data.topRated} title={t('home.topRated')} />
        <MediaSection items={data.upcoming} title={t('home.comingSoon')} />
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
