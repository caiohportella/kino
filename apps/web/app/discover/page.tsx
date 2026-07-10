'use client'

import { useQuery } from '@tanstack/react-query'
import { Button, EmptyState } from '@kino/ui'
import { useTranslation } from '@/lib/i18n'
import { MediaSection } from '@/components/media-section'
import { PageHeader } from '@/components/page-header'
import { LoadingPanel } from '@/components/loading-panel'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

export default function DiscoverPage() {
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['discover', language],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const [trending, popularMovies, popularTV, topRated, nowPlaying, upcoming] = await Promise.all([
        tmdb.getTrending('all', 'week'),
        tmdb.getPopularMovies(),
        tmdb.getPopularTV(),
        tmdb.getTopRatedMovies(),
        tmdb.getNowPlayingMovies(),
        tmdb.getUpcomingMovies(),
      ])

      return { trending, popularMovies, popularTV, topRated, nowPlaying, upcoming }
    },
  })

  if (query.isLoading) return <LoadingPanel label={t('common.loading')} />

  if (query.error || !query.data) {
    return (
      <EmptyState
        action={
          <Button onClick={() => query.refetch()} tone="secondary">
            {t('common.tryAgain')}
          </Button>
        }
        body={query.error instanceof Error ? query.error.message : 'TMDB did not respond.'}
        title={t('common.failed')}
      />
    )
  }

  return (
    <div className="content-frame">
      <PageHeader title={t('tabs.home')} />

      <MediaSection items={query.data.trending} title={t('home.trending')} />
      <MediaSection items={query.data.popularMovies} title={t('home.popularMovies')} />
      <MediaSection items={query.data.popularTV} title={t('home.popularTV')} />
      <MediaSection items={query.data.nowPlaying} title={t('home.newReleases')} />
      <MediaSection items={query.data.topRated} title={t('home.topRated')} />
      <MediaSection items={query.data.upcoming} title={t('home.comingSoon')} />
    </div>
  )
}
