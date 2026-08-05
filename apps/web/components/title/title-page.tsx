'use client'

import type { MediaType } from '@kino/core'
import { toReviewAuthor } from '@kino/core'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/kino'
import { TitleSkeleton } from '@/components/skeletons/page-skeletons'
import { TitleActions } from '@/components/title/title-actions'
import { getUpcomingSeason, TitleHeader } from '@/components/title/title-header'
import {
  CommunityRatingsPanel,
  TitleDiscoverySection,
  TitleSynopsisAndRating,
} from '@/components/title/title-metadata'
import { SeasonTabs } from '@/components/title/title-seasons'
import { TitleSidebar } from '@/components/title/title-sidebar'
import { Card } from '@/components/ui/card'
import { useTitleActions } from '@/hooks/title/use-title-actions'
import { ANON_TITLE_ID, useTitleData } from '@/hooks/title/use-title-data'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { useTranslation } from '@/lib/i18n'
import { parseResourceSegment } from '@/lib/routes'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

export function TitlePage() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = (searchParams.get('type') === 'tv' ? 'tv' : 'movie') as MediaType
  const tmdbId = parseResourceSegment(params.id).id
  const user = useAuthStore((state) => state.user)
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()

  const {
    titleQuery,
    title,
    currentProfileQuery,
    userDataQuery,
    statsQuery,
    nowPlayingQuery,
    contextQuery,
  } = useTitleData({ tmdbId, type, language, userId: user?.id })

  const reviewAuthor = currentProfileQuery.data ? toReviewAuthor(currentProfileQuery.data) : null

  const { rateMutation, deleteMovieEntryMutation } = useTitleActions({
    title,
    type,
    userId: user?.id,
  })

  function requestAuthForCurrentTitle() {
    const query = searchParams.toString()
    storeAuthRedirect(`${pathname}${query ? `?${query}` : ''}`)
    router.push('/auth/login')
  }

  if (titleQuery.isLoading) return <TitleSkeleton label={t('common.loading')} />

  if (titleQuery.error || !title) {
    return (
      <EmptyState
        body={
          titleQuery.error instanceof Error
            ? titleQuery.error.message
            : 'This TMDB title could not be loaded.'
        }
        illustrationLabel={t('emptyStates.missingIllustration')}
        title={t('title.notFound')}
        variant="missing"
      />
    )
  }

  const userData = userDataQuery.data
  const personalRating = userData?.userRating
  const currentUserRating =
    personalRating?.userId === user?.id ? Number(personalRating?.rating ?? 0) : 0
  const ticketsUrl = `https://www.ingresso.com.br/busca/resultado?q=${encodeURIComponent(title.title)}`
  const isNowPlayingInBrazil =
    nowPlayingQuery.data?.some((movie) => movie.id === title.tmdbId) ?? false
  const upcomingSeason = getUpcomingSeason(title)
  const canUsePersonalActions = Boolean(user && title.id !== ANON_TITLE_ID)
  const shareUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  return (
    <div className="content-frame">
      <TitleHeader
        actions={
          <TitleActions
            canUsePersonalActions={canUsePersonalActions}
            hasLastWatch={Boolean(userData?.lastWatch)}
            isWatchlisted={Boolean(userData?.isWatchlisted)}
            onAuthRequired={requestAuthForCurrentTitle}
            shareUrl={shareUrl}
            showTickets={type === 'movie' && isNowPlayingInBrazil}
            ticketsUrl={ticketsUrl}
            title={title}
            userId={user?.id}
          />
        }
        title={title}
        upcomingSeason={upcomingSeason}
      />

      <div className="grid w-full min-w-0 max-w-full items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="grid w-full min-w-0 max-w-full items-start gap-6">
          <TitleSynopsisAndRating
            currentUserRating={currentUserRating}
            deleteMovieEntryMutation={deleteMovieEntryMutation}
            onAuthRequired={requestAuthForCurrentTitle}
            rateMutation={rateMutation}
            title={title}
            user={user}
          />

          {title.type === 'tv' && title.totalSeasons ? (
            <Card className="p-5 md:p-6">
              <SeasonTabs
                onAuthRequired={requestAuthForCurrentTitle}
                title={title}
                tmdbId={title.tmdbId}
                userCanRate={Boolean(user && title.id !== ANON_TITLE_ID)}
                userId={user?.id}
              />
            </Card>
          ) : null}

          {title.type === 'movie' ? (
            <>
              <CommunityRatingsPanel
                showFollowed={Boolean(user)}
                stats={statsQuery.data}
                titleId={title.id}
                type={title.type}
              />
              <TitleDiscoverySection
                contextQuery={contextQuery}
                currentUserRating={currentUserRating}
                onAuthRequired={requestAuthForCurrentTitle}
                reviewAuthor={reviewAuthor}
                reviewAuthorLoading={Boolean(user && currentProfileQuery.isLoading)}
                title={title}
                user={user}
              />
            </>
          ) : null}
        </main>

        <TitleSidebar contextQuery={contextQuery} stats={statsQuery.data} title={title} />
      </div>

      {title.type === 'tv' ? (
        <div className="mt-6 grid w-full min-w-0 max-w-full gap-6">
          <TitleDiscoverySection
            contextQuery={contextQuery}
            currentUserRating={currentUserRating}
            onAuthRequired={requestAuthForCurrentTitle}
            reviewAuthor={reviewAuthor}
            reviewAuthorLoading={Boolean(user && currentProfileQuery.isLoading)}
            title={title}
            user={user}
          />
        </div>
      ) : null}
    </div>
  )
}
