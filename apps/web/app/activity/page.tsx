'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ActivityCard } from '@/components/activity-feed/activity-card'
import { ActivityFeedSkeleton } from '@/components/activity-feed/activity-feed-skeleton'
import { ProtectedContentGate } from '@/components/auth/protected-content-gate'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState } from '@/components/kino'
import { AppPagination } from '@/components/layout/app-pagination'
import { PageHeader } from '@/components/layout/page-header'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useActivityFeed } from '@/hooks/activity/use-activity-feed'
import { useReviewLikeMutation } from '@/hooks/reviews/use-review-like-mutation'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import type { ActivityFeedCard, ActivityFeedFilter } from '@/lib/activity/activity-feed'
import { formatLocalizedDate, formatLocalizedRelativeTime } from '@/lib/date'
import { useLocale, useTranslation } from '@/lib/localization/i18n'
import { db, getTmdb } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

function ActivityFeedItem({
  activity,
  locale,
  localizedTitle,
  onAuthRequired,
  viewerId,
}: {
  activity: ActivityFeedCard
  locale: string
  localizedTitle: {
    title: string
    posterUrl: string | null
    year: number | null
  } | null
  onAuthRequired: () => void
  viewerId: string | null
}) {
  const likeMutation = useReviewLikeMutation({ kind: 'activity' })

  const canLikeReview = Boolean(viewerId && activity.review && activity.actor.id !== viewerId)

  const pendingLike =
    activity.review !== null &&
    likeMutation.isPending &&
    likeMutation.variables?.reviewId === activity.review.id

  return (
    <ActivityCard
      activity={activity}
      canLikeReview={canLikeReview}
      locale={locale}
      localizedTitle={localizedTitle}
      onAuthRequired={onAuthRequired}
      onLikeReview={() => {
        if (!activity.review) return

        likeMutation.mutate({
          authorProfileId: activity.actor.id,
          liked: activity.review.likedByViewer,
          reviewId: activity.review.id,
        })
      }}
      pendingLike={pendingLike}
    />
  )
}

export default function ActivityPage() {
  const user = useAuthStore((state) => state.user)

  const resolution = useAuthStore(
    (state) =>
      state.resolution ?? {
        status: 'auth-loading',
      }
  )

  const { t } = useTranslation()
  const { locale, region } = useLocale()

  const [filter, setFilter] = useState<ActivityFeedFilter>('you')

  const [page, setPage] = useState(1)

  const itemsPerPage = 30

  const viewerId = user?.id ?? null

  const viewerProfile = useQuery({
    queryKey: ['activity-profile', viewerId],
    queryFn: () => db.getUserProfile(viewerId!),
    enabled: Boolean(viewerId),
  })

  const feed = useActivityFeed(viewerId, filter, locale, region, Boolean(viewerId))

  const followingFeed = useActivityFeed(viewerId, 'following', locale, region, Boolean(viewerId))

  const totalPages = Math.max(1, Math.ceil(feed.items.length / itemsPerPage))

  const currentPage = Math.min(page, totalPages)

  const paginatedItems = feed.items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const localizedTitleRequests = useMemo(
    () =>
      paginatedItems
        .filter((item) => item.subject.kind === 'title')
        .map((item) => ({
          tmdbId: item.subject.kind === 'title' ? item.subject.tmdbId : 0,
          type: item.subject.kind === 'title' ? item.subject.mediaType : 'movie',
        })),
    [paginatedItems]
  )

  const localizedTitles = useLocalizedTitles(localizedTitleRequests)

  const groupedItems = useMemo(() => {
    const groups: {
      dateKey: string
      dateLabel: string
      relativeLabel: string
      items: typeof paginatedItems
    }[] = []

    for (const item of paginatedItems) {
      const occurred = new Date(item.occurredAt)
      const dateKey = occurred.toDateString()
      const last = groups[groups.length - 1]

      if (last && last.dateKey === dateKey) {
        last.items.push(item)
        continue
      }

      groups.push({
        dateKey,
        dateLabel: formatLocalizedDate(item.occurredAt, locale, {
          dateStyle: 'long',
        }),
        relativeLabel: formatLocalizedRelativeTime(item.occurredAt, t),
        items: [item],
      })
    }

    return groups
  }, [paginatedItems, locale, t])

  const pageStatus =
    feed.isLoading || localizedTitles.isPending
      ? 'loading'
      : feed.isError || localizedTitles.isError
        ? 'error'
        : feed.items.length === 0
          ? 'empty'
          : 'content'

  const emptyTitleKey = filter === 'you' ? 'activity.emptyYouTitle' : 'activity.emptyFollowingTitle'

  const emptyBodyKey = filter === 'you' ? 'activity.emptyYouBody' : 'activity.emptyFollowingBody'

  const followingActors = useMemo(() => {
    const uniqueActors = new Map<string, ActivityFeedCard['actor']>()

    for (const activity of followingFeed.items) {
      uniqueActors.set(activity.actor.id, activity.actor)
    }

    return Array.from(uniqueActors.values())
  }, [followingFeed.items])

  const filterOptions = useMemo(
    () => [
      {
        label: (
          <span className="inline-flex items-center gap-2">
            <Avatar aria-hidden="true" className="size-5" size="sm">
              <AvatarImage
                src={viewerProfile.data?.avatar_url || user?.user_metadata?.avatar_url}
              />

              <AvatarFallback className="bg-kino-surface text-kino-text">
                {t('activity.filters.you').slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <span>{t('activity.filters.you')}</span>
          </span>
        ),
        value: 'you' as const,
      },
      {
        label: (
          <span className="inline-flex items-center gap-2">
            {followingActors.length > 0 ? (
              <AvatarGroup aria-hidden="true" className="-space-x-1.5">
                {followingActors.slice(0, 3).map((actor) => (
                  <Avatar className="size-5" key={actor.id} size="sm">
                    <AvatarImage alt="" src={actor.avatarUrl || undefined} />

                    <AvatarFallback className="bg-kino-surface text-kino-text">
                      {(actor.displayName || actor.username || '?').slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                ))}

                {followingActors.length >= 4 ? (
                  <AvatarGroupCount className="size-5 text-[10px]">
                    +{followingActors.length - 3}
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            ) : null}

            <span>{t('activity.filters.following')}</span>
          </span>
        ),
        value: 'following' as const,
      },
    ],
    [followingActors, t, user?.user_metadata?.avatar_url, viewerProfile.data?.avatar_url]
  )

  useEffect(() => {
    void filter
    setPage(1)
  }, [filter])

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  return (
    <ProtectedContentGate
      authLoadingFallback={
        <div className="content-frame">
          <ActivityFeedSkeleton count={5} label={t('activity.loading')} />
        </div>
      }
      emptyFallback={
        <div className="content-frame">
          <PageHeader
            title={t('activity.headerPhrase', {
              defaultValue: 'See what everyone has been watching.',
            })}
          />

          <EmptyState
            action={
              <Link href="/search">
                <Button>{t('search.title')}</Button>
              </Link>
            }
            body={t(emptyBodyKey)}
            illustrationLabel={t('emptyStates.diaryIllustration')}
            title={t(emptyTitleKey)}
            variant="diary"
          />
        </div>
      }
      errorFallback={
        <div className="content-frame">
          <PageHeader
            title={t('activity.headerPhrase', {
              defaultValue: 'See what everyone has been watching.',
            })}
          />

          <EmptyState
            body={feed.error?.message ?? t('common.tryAgain')}
            title={t('activity.error')}
            variant="diary"
          />
        </div>
      }
      pageLoadingFallback={
        <div className="content-frame">
          <ActivityFeedSkeleton count={5} label={t('activity.loading')} />
        </div>
      }
      pageStatus={pageStatus}
      resolution={resolution}
      unauthenticatedFallback={<ProtectedEmpty />}
    >
      <div className="content-frame">
        <PageHeader
          title={t('activity.headerPhrase', {
            defaultValue: 'See what everyone has been watching.',
          })}
        />

        <div className="mb-5 flex items-center justify-between gap-3">
          <SegmentedControl
            onChange={setFilter}
            activeClassName="data-active:!border-kino-accent data-active:!bg-kino-accent data-active:!text-black"
            options={filterOptions}
            value={filter}
          />
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            action={
              <Link href="/search">
                <Button>{t('search.title')}</Button>
              </Link>
            }
            body={t(emptyBodyKey)}
            illustrationLabel={t('emptyStates.diaryIllustration')}
            title={t(emptyTitleKey)}
            variant="diary"
          />
        ) : (
          <div className="grid gap-6">
            {groupedItems.map((group) => (
              <div className="grid gap-3" key={group.dateKey}>
                <div className="flex items-center gap-2 text-xs font-medium text-kino-subtle">
                  <CalendarDays aria-hidden="true" size={13} />

                  <span>{group.dateLabel}</span>
                </div>

                <div className="grid gap-3">
                  {group.items.map((activity) => {
                    const localized =
                      activity.subject.kind === 'title'
                        ? localizedTitles.data[
                            localizedTitleKey({
                              tmdbId: activity.subject.tmdbId,
                              type: activity.subject.mediaType,
                            })
                          ]
                        : undefined

                    return (
                      <ActivityFeedItem
                        activity={activity}
                        key={activity.id}
                        locale={locale}
                        localizedTitle={
                          localized
                            ? {
                                title: localized.title,
                                posterUrl: getTmdb().getImageUrl(localized.posterPath, 'w300'),
                                year: localized.year,
                              }
                            : null
                        }
                        onAuthRequired={() => {
                          // ProtectedContentGate prevents unauthenticated
                          // rendering, but keep the callback for the
                          // shared like button contract.
                        }}
                        viewerId={viewerId}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            <AppPagination
              ellipsisLabel={t('pagination.morePages', {
                defaultValue: 'More pages',
              })}
              label={t('pagination.label', {
                defaultValue: 'Pagination',
              })}
              nextText={t('pagination.next', {
                defaultValue: 'Next',
              })}
              onPageChange={setPage}
              page={currentPage}
              pageAriaLabel={(nextPage, currentPage) =>
                nextPage === currentPage
                  ? t('pagination.currentPage', {
                      defaultValue: 'Page {{page}}',
                      page: nextPage,
                    })
                  : t('pagination.goToPage', {
                      defaultValue: 'Go to page {{page}}',
                      page: nextPage,
                    })
              }
              previousText={t('pagination.previous', {
                defaultValue: 'Previous',
              })}
              summary={(currentPage, totalPages) =>
                t('pagination.summary', {
                  defaultValue: 'Page {{current}} of {{total}}',
                  current: currentPage,
                  total: totalPages,
                })
              }
              totalPages={totalPages}
            />
          </div>
        )}
      </div>
    </ProtectedContentGate>
  )
}
