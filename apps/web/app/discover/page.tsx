import { EmptyState } from '@/components/kino'
import { MediaSection } from '@/components/media-section'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { TrendingCarousel } from '@/components/trending-carousel'
import { translate } from '@/lib/localization'
import { getDiscoverData } from '@/lib/server-tmdb'
import { getRequestLanguage } from '@/lib/server-localization'
import { cn } from '@/lib/utils'

export default async function DiscoverPage() {
  const language = await getRequestLanguage()

  try {
    const data = await getDiscoverData(language)

    return (
      <div className="content-frame">
        <PageHeader title={translate(language, 'tabs.home')} />

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-kino-text">
              {translate(language, 'home.trending')}
            </h2>
          </div>
          <TrendingCarousel items={data.trending} />
        </section>
        <MediaSection items={data.popularMovies} title={translate(language, 'home.popularMovies')} />
        <MediaSection items={data.popularTV} title={translate(language, 'home.popularTV')} />
        <MediaSection items={data.nowPlaying} title={translate(language, 'home.newReleases')} />
        <MediaSection items={data.topRated} title={translate(language, 'home.topRated')} />
        <MediaSection items={data.upcoming} title={translate(language, 'home.comingSoon')} />
      </div>
    )
  } catch (error) {
    return (
      <EmptyState
        action={
          <Link
            className={cn(buttonVariants({ variant: 'secondary' }))}
            href="/discover"
          >
            {translate(language, 'common.tryAgain')}
          </Link>
        }
        body={error instanceof Error ? error.message : 'TMDB did not respond.'}
        illustrationLabel={translate(language, 'emptyStates.missingIllustration')}
        title={translate(language, 'common.failed')}
        variant="missing"
      />
    )
  }
}
