'use client'

import type { MediaType } from '@kino/core'
import { toReviewAuthor } from '@kino/core'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/kino'
import { TitleSkeleton } from '@/components/skeletons/page-skeletons'
import { TitleActions } from '@/components/title/title-actions'
import { MoreLikeThis } from '@/components/title/title-context'
import { getUpcomingSeason, TitleHeader } from '@/components/title/title-header'
import {
  CommunityRatingsPanel,
  TitleDiscoverySection,
  TitleSynopsis,
} from '@/components/title/title-metadata'
import { SeasonTabs } from '@/components/title/title-seasons'
import { TitleSection } from '@/components/title/title-section'
import { TitleSidebar } from '@/components/title/title-sidebar'
import { useTitleActions } from '@/hooks/title/use-title-actions'
import { ANON_TITLE_ID, useTitleData } from '@/hooks/title/use-title-data'
import { storeAuthRedirect } from '@/lib/auth/auth-redirect'
import { useTranslation } from '@/lib/localization/i18n'
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
  } = useTitleData({
    tmdbId,
    type,
    language,
    userId: user?.id,
  })

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

  if (titleQuery.isLoading) {
    return <TitleSkeleton label={t('common.loading')} />
  }

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

  const ticketsUrl = `https://www.ingresso.com.br/busca/resultado?q=${encodeURIComponent(
    title.title
  )}`

  const isNowPlayingInBrazil =
    nowPlayingQuery.data?.some((movie) => movie.id === title.tmdbId) ?? false

  const upcomingSeason = getUpcomingSeason(title)

  const canUsePersonalActions = Boolean(user && title.id !== ANON_TITLE_ID)

  const query = searchParams.toString()
  const shareUrl = `${pathname}${query ? `?${query}` : ''}`

  const hasSeasons = title.type === 'tv' && Boolean(title.totalSeasons)

  return (
    <div className="content-frame">
      <TitleHeader
        actions={
          <TitleActions
            canUsePersonalActions={canUsePersonalActions}
            hasLastWatch={Boolean(userData?.lastWatch)}
            isWatchlisted={Boolean(userData?.isWatchlisted)}
            onAuthRequiredAction={requestAuthForCurrentTitle}
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

      <div
        className="
          mt-8
          grid w-full min-w-0
          items-start gap-8

          xl:grid-cols-[minmax(0,1fr)_300px]
          xl:gap-10

          2xl:grid-cols-[minmax(0,1fr)_320px]
        "
      >
        <main className="min-w-0">
          <TitleSection>
            <TitleSynopsis title={title} />
          </TitleSection>

          {hasSeasons ? (
            <TitleSection>
              <SeasonTabs
                onAuthRequired={requestAuthForCurrentTitle}
                title={title}
                tmdbId={title.tmdbId}
                userCanRate={canUsePersonalActions}
                userId={user?.id}
              />
            </TitleSection>
          ) : null}

          <TitleSection>
            <CommunityRatingsPanel
              currentUserRating={currentUserRating}
              deleteMovieEntryMutation={deleteMovieEntryMutation}
              embedded
              onAuthRequired={requestAuthForCurrentTitle}
              rateMutation={rateMutation}
              showFollowed={Boolean(user)}
              stats={statsQuery.data}
              titleId={title.id}
              type={title.type}
              viewerAuthenticated={Boolean(user)}
            />
          </TitleSection>

          <TitleSection className="pb-8">
            <TitleDiscoverySection
              contextQuery={contextQuery}
              currentUserRating={currentUserRating}
              onAuthRequired={requestAuthForCurrentTitle}
              reviewAuthor={reviewAuthor}
              reviewAuthorLoading={Boolean(user && currentProfileQuery.isLoading)}
              title={title}
              user={user}
            />
          </TitleSection>
        </main>

        <aside
          className="
            min-w-0

            xl:sticky
            xl:top-[calc(var(--shell-header-height)+1.5rem)]
          "
        >
          <TitleSidebar contextQuery={contextQuery} stats={statsQuery.data} title={title} />
        </aside>
      </div>

      <TitleSection className="pb-8">
        <MoreLikeThis
          embedded
          error={contextQuery.data?.errors.recommendations || contextQuery.isError}
          items={contextQuery.data?.recommendations}
          loading={contextQuery.isLoading}
        />
      </TitleSection>
    </div>
  )
}
