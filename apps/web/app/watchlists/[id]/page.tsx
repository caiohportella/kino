'use client'

import type { UserProfile, Watchlist, WatchlistItemDetails, WatchlistVisibility } from '@kino/core'
import { findNextKnownSeason, formatDate } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, LogOut, Pencil, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, Poster } from '@/components/kino'
import { AppPagination } from '@/components/layout/app-pagination'
import { PageHeader } from '@/components/layout/page-header'
import { ShareButton } from '@/components/share-button'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useToast } from '@/components/toast-provider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { ModalDialog as Dialog } from '@/components/ui/modal-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ShareCodeDisplay } from '@/components/watchlist/watchlist-sharing'
import { WatchlistVisibilitySelector } from '@/components/watchlist/watchlist-visibility-selector'
import { useTranslation } from '@/lib/i18n'
import { resolveLocalizedTitlePresentation } from '@/lib/localized-title-presentation'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { parseWatchlistSegment, titlePath, watchlistPath } from '@/lib/routes'
import { db, getTmdb } from '@/lib/services'
import { useLocalizedTitles } from '@/lib/use-localized-titles'
import { publishWatchlistChange } from '@/lib/watchlist-cache-sync'
import { useAuthStore } from '@/stores/auth-store'

interface WatchlistDetailData {
  watchlist: Watchlist | null
  items: WatchlistItemDetails[]
  participants: UserProfile[]
  canEdit: boolean
  isOwner: boolean
}

type WatchlistProgressFilter = 'all' | 'watched' | 'to-watch'

const WATCHLIST_ROWS_PER_PAGE = 4

export default function WatchlistDetailPage() {
  const params = useParams<{ id: string }>()
  const watchlistId = parseWatchlistSegment(params.id).id
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WatchlistItemDetails | null>(null)
  const [progressFilter, setProgressFilter] = useState<WatchlistProgressFilter>('all')
  const detailQueryKey = ['watchlist-detail', watchlistId] as const
  const [page, setPage] = useState(1)
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null)
  const [gridColumns, setGridColumns] = useState(1)

  const query = useQuery<WatchlistDetailData>({
    queryKey: detailQueryKey,
    queryFn: async () => {
      const [watchlist, items, access] = await Promise.all([
        db.getWatchlist(watchlistId),
        db.getWatchlistItems(watchlistId),
        db.getWatchlistAccess(watchlistId),
      ])
      if (!watchlist) return { watchlist, items, participants: [], ...access }

      const [owner, collaborators] = await Promise.all([
        db.getUserProfile(watchlist.userId),
        db.getWatchlistCollaborators(watchlist.id).catch(() => []),
      ])
      const participants = Array.from(
        new Map(
          [owner, ...collaborators]
            .filter((profile): profile is UserProfile => Boolean(profile))
            .map((profile) => [profile.id, profile])
        ).values()
      )

      return { watchlist, items, participants, ...access }
    },
  })
  const watchlistItems = query.data?.items || []
  const localizedTitles = useLocalizedTitles(
    watchlistItems.map((item) => ({
      tmdbId: item.title.tmdb_id,
      type: item.title.type,
    }))
  )

  const viewerMediaQuery = useQuery({
    queryKey: ['viewer-media-status', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return {
          movies: [],
          series: [],
        }
      }

      const [movies, series] = await Promise.all([
        db.getWatchedMovies(user.id),
        db.getWatchedSeries(user.id),
      ])

      return {
        movies,
        series,
      }
    },
  })

  const viewerMediaStatus = useMemo(() => {
    const watchedMovies = new Set(
      (viewerMediaQuery.data?.movies ?? []).map((movie) => movie.tmdb_id)
    )

    const watchedSeries = new Map(
      (viewerMediaQuery.data?.series ?? []).map((series) => [series.tmdb_id, series])
    )

    return {
      watchedMovies,
      watchedSeries,
    }
  }, [viewerMediaQuery.data])

  const isItemWatched = (item: WatchlistItemDetails) => {
    if (item.title.type === 'movie') {
      return viewerMediaStatus.watchedMovies.has(item.title.tmdb_id)
    }

    return viewerMediaStatus.watchedSeries.get(item.title.tmdb_id)?.is_caught_up === true
  }

  const isOwner = query.data?.isOwner || false
  const canEdit = query.data?.canEdit || false
  const copyText = query.data?.watchlist?.shareCode || ''
  const removeTargetTitle = removeTarget
    ? resolveLocalizedTitlePresentation({
        ...localizedTitles,
        request: {
          tmdbId: removeTarget.title.tmdb_id,
          type: removeTarget.title.type,
        },
        unknownTitle: t('diary.unknownTitle'),
      }).title
    : t('diary.unknownTitle')

  useEffect(() => {
    const watchlist = query.data?.watchlist
    if (!watchlist || watchlist.visibility !== 'public') return
    const canonical = watchlistPath(watchlist.id, watchlist.name)
    if (canonical !== `/watchlists/${params.id}`) router.replace(canonical)
  }, [params.id, query.data?.watchlist, router])

  useEffect(() => {
    if (!gridElement) return

    const updateGridColumns = () => {
      const styles = window.getComputedStyle(gridElement)

      const columns = styles.gridTemplateColumns.split(' ').filter(Boolean).length

      setGridColumns(Math.max(1, columns))
    }

    updateGridColumns()

    const observer = new ResizeObserver(updateGridColumns)
    observer.observe(gridElement)

    return () => observer.disconnect()
  }, [gridElement])

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItemDetails) => db.removeFromWatchlist(watchlistId, item.title.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey })
      const previous = queryClient.getQueryData<WatchlistDetailData>(detailQueryKey)
      queryClient.setQueryData<WatchlistDetailData>(detailQueryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((entry) => entry.id !== item.id),
            }
          : current
      )
      return { previous }
    },
    onError: (_error, _item, context) => {
      if (context?.previous) queryClient.setQueryData(detailQueryKey, context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToRemoveItem') })
    },
    onSuccess: () => {
      publishWatchlistChange(watchlistId)
      notify({ tone: 'success', title: t('watchlists.itemRemoved') })
      setRemoveTarget(null)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
        ...(query.data?.watchlist && user?.id
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'watchlist',
                profileId: query.data.watchlist.userId,
                visibilityScope: { kind: 'authenticated', userId: user.id },
              }),
            ]
          : []),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ]),
  })

  const deleteMutation = useMutation({
    mutationFn: () => db.deleteWatchlist(watchlistId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== watchlistId) ?? current
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['watchlists', user?.id], context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToDeleteWatchlist') })
    },
    onSuccess: () => {
      publishWatchlistChange(watchlistId)
      notify({ tone: 'success', title: t('watchlists.deleted') })
      queryClient.removeQueries({ queryKey: detailQueryKey })
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] }),
        ...(query.data?.watchlist && user?.id
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'watchlist',
                profileId: query.data.watchlist.userId,
                visibilityScope: { kind: 'authenticated', userId: user.id },
              }),
            ]
          : []),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ])
      router.replace('/watchlists')
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => db.leaveWatchlist(watchlistId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlists', user?.id] })
      const previous = queryClient.getQueryData<Watchlist[]>(['watchlists', user?.id])
      queryClient.setQueryData<Watchlist[]>(
        ['watchlists', user?.id],
        (current) => current?.filter((watchlist) => watchlist.id !== watchlistId) ?? current
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['watchlists', user?.id], context.previous)
      notify({ tone: 'error', title: t('watchlists.failedToLeaveWatchlist') })
    },
    onSuccess: () => {
      notify({ tone: 'success', title: t('watchlists.left') })
      queryClient.removeQueries({ queryKey: detailQueryKey })
      queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] })
      router.replace('/watchlists')
    },
  })

  if (query.isPending || localizedTitles.isPending) {
    return <WatchlistsSkeleton detail label={t('watchlists.loadingWatchlist')} />
  }

  if (!query.data?.watchlist) {
    return (
      <EmptyState
        body={t('watchlists.notFoundBody')}
        illustrationLabel={t('emptyStates.missingIllustration')}
        title={t('watchlists.notFound')}
        variant="missing"
      />
    )
  }

  const { watchlist, items, participants } = query.data
  const isParticipant = Boolean(
    user?.id && !isOwner && participants.some((participant) => participant.id === user.id)
  )
  const isSharedWatchlist = watchlist.visibility === 'shared' && participants.length > 1
  const watchedCount = items.filter(isItemWatched).length
  const toWatchCount = items.length - watchedCount

  const progressPercentage = items.length > 0 ? Math.round((watchedCount / items.length) * 100) : 0

  const filteredItems =
    progressFilter === 'watched'
      ? items.filter(isItemWatched)
      : progressFilter === 'to-watch'
        ? items.filter((item) => !isItemWatched(item))
        : items

  const pageSize = gridColumns * WATCHLIST_ROWS_PER_PAGE

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))

  const currentPage = Math.min(page, totalPages)

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeProgressFilter = (filter: WatchlistProgressFilter) => {
    setProgressFilter(filter)
    setPage(1)
  }

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-3">
            {watchlist.visibility === 'shared' && copyText ? (
              <ShareButton
                text={t('sharing.watchlistText', { title: watchlist.name })}
                title={watchlist.name}
                url={`/watchlists/shared/${encodeURIComponent(copyText)}`}
              />
            ) : null}
            {watchlist.visibility === 'public' ? (
              <ShareButton
                text={t('sharing.watchlistText', { title: watchlist.name })}
                title={watchlist.name}
                url={watchlistPath(watchlist.id, watchlist.name)}
              />
            ) : null}
            {canEdit ? (
              <>
                <Button onClick={() => setEditOpen(true)} variant="secondary">
                  <Pencil size={16} />
                  {t('watchlists.edit')}
                </Button>
                {isOwner ? (
                  <Button
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 size={16} />
                    {deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
                  </Button>
                ) : null}
              </>
            ) : isParticipant ? (
              <Button
                disabled={leaveMutation.isPending}
                onClick={() => setLeaveOpen(true)}
                variant="destructive"
              >
                <LogOut size={16} />
                {leaveMutation.isPending ? t('watchlists.leaving') : t('watchlists.leave')}
              </Button>
            ) : null}
          </div>
        }
        body={watchlist.description || t('watchlists.defaultDescription')}
        eyebrow={t(`watchlists.visibilityLabels.${watchlist.visibility}`)}
        title={watchlist.name}
      />

      {isSharedWatchlist ? (
        <Card className="mb-6 w-full min-w-0 max-w-full flex-row flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-kino-muted">
            {t('watchlists.participants')}
          </span>

          {participants.map((profile) => (
            <Link
              className={buttonVariants({
                className: 'min-w-0 max-w-full',
                variant: 'secondary',
              })}
              key={profile.id}
              href={`/${profile.username}`}
            >
              <ProfileAvatar profile={profile} size="sm" />
              <span className="min-w-0 truncate">
                {profile.display_name || profile.username || t('watchlists.kinoUser')}
              </span>
            </Link>
          ))}
        </Card>
      ) : null}

      {user && items.length > 0 ? (
        <section className="mb-8 rounded-lg p-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-kino-muted">
                {t('watchlists.progress.label', {
                  defaultValue: 'Progress',
                })}
              </p>

              <p className="mt-1 text-3xl font-bold tracking-tight text-kino-text">
                {t('watchlists.progress.summary', {
                  defaultValue: '{{watched}} of {{total}} watched',
                  watched: watchedCount,
                  total: items.length,
                })}
              </p>
            </div>

            <div
              aria-label={t('watchlists.progress.percentage', {
                defaultValue: '{{percentage}}% watched',
                percentage: progressPercentage,
              })}
              className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full"
              role="img"
              style={{
                background: `conic-gradient(#1db954 ${progressPercentage * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
              }}
            >
              <div className="absolute inset-1 rounded-full bg-kino-bg" />

              <span className="relative text-base font-bold text-kino-text">
                {progressPercentage}%
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              aria-pressed={progressFilter === 'all'}
              className={
                progressFilter === 'all'
                  ? 'border-kino-accent/30 bg-kino-accent/10 text-kino-accent hover:bg-kino-accent/15'
                  : undefined
              }
              onClick={() => changeProgressFilter('all')}
              size="sm"
              variant={progressFilter === 'all' ? 'secondary' : 'ghost'}
            >
              {t('watchlists.progress.all', {
                defaultValue: 'All {{count}}',
                count: items.length,
              })}
            </Button>

            <Button
              aria-pressed={progressFilter === 'watched'}
              className={
                progressFilter === 'watched'
                  ? 'border-kino-accent/30 bg-kino-accent/10 text-kino-accent hover:bg-kino-accent/15'
                  : undefined
              }
              onClick={() => changeProgressFilter('watched')}
              size="sm"
              variant={progressFilter === 'watched' ? 'secondary' : 'ghost'}
            >
              {t('watchlists.progress.watched', {
                defaultValue: 'Watched {{count}}',
                count: watchedCount,
              })}
            </Button>

            <Button
              aria-pressed={progressFilter === 'to-watch'}
              className={
                progressFilter === 'to-watch'
                  ? 'border-kino-accent/30 bg-kino-accent/10 text-kino-accent hover:bg-kino-accent/15'
                  : undefined
              }
              onClick={() => changeProgressFilter('to-watch')}
              size="sm"
              variant={progressFilter === 'to-watch' ? 'secondary' : 'ghost'}
            >
              {t('watchlists.progress.toWatch', {
                defaultValue: 'To watch {{count}}',
                count: toWatchCount,
              })}
            </Button>
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonVariants()} href="/search">
              {t('watchlists.searchTitles')}
            </Link>
          }
          body={t('watchlists.emptyListHint')}
          illustrationLabel={t('emptyStates.watchlistIllustration')}
          title={t('watchlists.emptyList')}
          variant="watchlist"
        />
      ) : (
        <>
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]"
            ref={setGridElement}
          >
            {paginatedItems.map((item) => {
              const localized = resolveLocalizedTitlePresentation({
                ...localizedTitles,
                request: {
                  tmdbId: item.title.tmdb_id,
                  type: item.title.type,
                },
                unknownTitle: t('diary.unknownTitle'),
              })

              if (localizedTitles.isPending) {
                return (
                  <div aria-busy="true" className="grid min-w-0 content-start gap-3" key={item.id}>
                    <Skeleton className="aspect-2/3 w-full rounded-lg" />
                    <Skeleton className="h-10 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                )
              }

              if (localized.status !== 'ready') {
                return (
                  <article className="grid min-w-0 content-start gap-3" key={item.id}>
                    <div className="grid aspect-2/3 place-items-center rounded-lg border border-white/10 bg-kino-surface px-4 text-center text-xs font-semibold text-kino-muted">
                      {t('watchlists.titleUnavailable')}
                    </div>

                    <h2 className="line-clamp-2 h-10 text-sm font-semibold leading-5 text-kino-muted">
                      {t('watchlists.titleUnavailable')}
                    </h2>
                  </article>
                )
              }

              const displayTitle = localized.title
              const poster = getTmdb().getImageUrl(localized.posterPath, 'w300')

              const series =
                item.title.type === 'tv'
                  ? viewerMediaStatus.watchedSeries.get(item.title.tmdb_id)
                  : undefined

              const completed = isItemWatched(item)

              const nextKnownSeason =
                series?.is_caught_up === true ? findNextKnownSeason(series) : null

              const profile = item.addedByUser || {
                avatar_url: null,
                display_name: null,
                username: null,
              }

              const releaseYear = localized.year ?? item.title.release_year

              return (
                <article className="relative min-w-0" key={item.id}>
                  <Poster
                    artworkOverlay={
                      <>
                        {isSharedWatchlist ? (
                          <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
                            <ProfileAvatar profile={profile} size="poster" />
                          </div>
                        ) : null}

                        {canEdit ? (
                          <button
                            aria-label={t('watchlists.removeTitle', {
                              title: displayTitle,
                            })}
                            className="pointer-events-auto absolute bottom-2 right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/85"
                            onClick={() => setRemoveTarget(item)}
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </>
                    }
                    className="rounded-lg shadow-soft"
                    details={{
                      completed,
                      upcomingSeasonLabel: nextKnownSeason
                        ? t('seasons.season', {
                            number: nextKnownSeason.season,
                          })
                        : null,
                      year: releaseYear,
                    }}
                    src={poster}
                    title={displayTitle}
                  />

                  <div className="mt-2 flex min-w-0 items-center text-xs text-kino-muted">
                    <time dateTime={item.addedAt.toISOString()}>
                      {t('watchlists.addedOn', {
                        date: formatDate(item.addedAt),
                      })}
                    </time>
                  </div>

                  <Link
                    aria-label={displayTitle}
                    className="absolute inset-0 z-10 rounded-lg focus-ring"
                    href={titlePath(item.title.tmdb_id, displayTitle, item.title.type)}
                  >
                    <span className="sr-only">{displayTitle}</span>
                  </Link>
                </article>
              )
            })}
          </div>

          <AppPagination
            ellipsisLabel={t('pagination.morePages')}
            label={t('pagination.label')}
            nextText={t('pagination.next')}
            onPageChange={setPage}
            page={currentPage}
            pageAriaLabel={(nextPage, currentPage) =>
              nextPage === currentPage
                ? t('pagination.currentPage', { page: nextPage })
                : t('pagination.goToPage', { page: nextPage })
            }
            previousText={t('pagination.previous')}
            summary={(currentPage, totalPages) =>
              t('pagination.summary', {
                current: currentPage,
                total: totalPages,
              })
            }
            totalPages={totalPages}
          />
        </>
      )}

      <ConfirmActionDialog
        actionLabel={deleteMutation.isPending ? t('watchlists.deleting') : t('common.delete')}
        description={t('watchlists.deleteWatchlistConfirm')}
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        pending={deleteMutation.isPending}
        title={t('watchlists.deleteWatchlist')}
      />
      <ConfirmActionDialog
        actionLabel={leaveMutation.isPending ? t('watchlists.leaving') : t('watchlists.leave')}
        description={t('watchlists.leaveWatchlistConfirm')}
        onConfirm={() => leaveMutation.mutate()}
        onOpenChange={setLeaveOpen}
        open={leaveOpen}
        pending={leaveMutation.isPending}
        title={t('watchlists.leaveWatchlist')}
      />
      <ConfirmActionDialog
        actionLabel={removeMutation.isPending ? t('common.loading') : t('common.remove')}
        description={t('watchlists.removeFromListConfirm', {
          title: removeTargetTitle,
        })}
        onConfirm={() => (removeTarget ? removeMutation.mutate(removeTarget) : undefined)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        open={Boolean(removeTarget)}
        pending={removeMutation.isPending}
        title={t('watchlists.removeFromListTitle')}
      />

      <EditWatchlistDialog
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: detailQueryKey }),
            queryClient.invalidateQueries({
              queryKey: ['watchlists', user?.id],
            }),
            ...(user?.id
              ? [
                  invalidateProfileMutation(queryClient, {
                    kind: 'watchlist',
                    profileId: watchlist.userId,
                    visibilityScope: { kind: 'authenticated', userId: user.id },
                  }),
                ]
              : []),
            queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
          ])
        }}
        open={editOpen}
        watchlist={watchlist}
      />
    </div>
  )
}

function ProfileAvatar({
  profile,
  size = 'sm',
}: {
  profile: Pick<UserProfile, 'avatar_url' | 'display_name' | 'username'>
  size?: 'xs' | 'sm' | 'poster'
}) {
  const initials = (profile.display_name || profile.username || 'K')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  const className =
    size === 'poster'
      ? 'h-10 w-10 rounded-full border-2 border-kino-bg bg-kino-surface shadow-soft'
      : size === 'xs'
        ? 'h-6 w-6 rounded-full'
        : 'h-8 w-8 rounded-full'

  return (
    <Avatar className={className}>
      <AvatarImage alt="" src={profile.avatar_url || undefined} />
      <AvatarFallback className="bg-kino-elevated text-xs">{initials}</AvatarFallback>
    </Avatar>
  )
}

function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm} variant="destructive">
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function EditWatchlistDialog({
  open,
  onClose,
  onSaved,
  watchlist,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  watchlist: Watchlist
}) {
  const { t } = useTranslation()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const viewerId = useAuthStore((state) => state.user?.id)
  const [name, setName] = useState(watchlist.name)
  const [description, setDescription] = useState(watchlist.description || '')
  const [visibility, setVisibility] = useState<WatchlistVisibility>(watchlist.visibility)
  const [shareCode, setShareCode] = useState(watchlist.shareCode || '')
  const mutation = useMutation({
    mutationFn: () =>
      db.updateWatchlist(watchlist.id, {
        name,
        description,
      }),
    onSuccess: (updated) => {
      publishWatchlistChange(updated.id)
      queryClient.setQueryData<WatchlistDetailData>(
        ['watchlist-detail', watchlist.id],
        (current) => (current ? { ...current, watchlist: updated } : current)
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item))
      )
      notify({ tone: 'success', title: t('watchlists.editSaved') })
      onSaved()
      onClose()
    },
    onError: () => notify({ tone: 'error', title: t('common.failedToSave') }),
  })
  const visibilityMutation = useMutation({
    mutationFn: (nextVisibility: WatchlistVisibility) =>
      db.setWatchlistVisibility(watchlist.id, nextVisibility),
    onMutate: async (nextVisibility) => {
      const detailKey = ['watchlist-detail', watchlist.id]
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: ['watchlists'] }),
      ])
      const previousDetail = queryClient.getQueryData<WatchlistDetailData>(detailKey)
      const previousLists = queryClient.getQueriesData<Watchlist[]>({
        queryKey: ['watchlists'],
      })
      setVisibility(nextVisibility)
      if (nextVisibility !== 'shared') setShareCode('')
      const applyOptimistic = (item: Watchlist) =>
        item.id === watchlist.id
          ? {
              ...item,
              visibility: nextVisibility,
              isShared: nextVisibility === 'shared',
              shareCode: nextVisibility === 'shared' ? item.shareCode : undefined,
            }
          : item
      queryClient.setQueryData<WatchlistDetailData>(detailKey, (current) =>
        current?.watchlist ? { ...current, watchlist: applyOptimistic(current.watchlist) } : current
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map(applyOptimistic)
      )
      return { previousDetail, previousLists }
    },
    onSuccess: (updated) => {
      publishWatchlistChange(updated.id)
      setShareCode(updated.shareCode || '')
      setVisibility(updated.visibility)
      queryClient.setQueryData<WatchlistDetailData>(
        ['watchlist-detail', watchlist.id],
        (current) => (current ? { ...current, watchlist: updated } : current)
      )
      queryClient.setQueriesData<Watchlist[]>({ queryKey: ['watchlists'] }, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item))
      )
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['watchlist-picker'] }),
        ...(viewerId
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'watchlist',
                profileId: watchlist.userId,
                visibilityScope: { kind: 'authenticated', userId: viewerId },
              }),
            ]
          : []),
        queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
      ])
      notify({
        tone: 'success',
        title: t('watchlists.visibilityUpdated'),
      })
    },
    onError: (_error, _nextVisibility, context) => {
      setVisibility(watchlist.visibility)
      setShareCode(watchlist.shareCode || '')
      if (context?.previousDetail) {
        queryClient.setQueryData(['watchlist-detail', watchlist.id], context.previousDetail)
      }
      for (const [key, data] of context?.previousLists || []) queryClient.setQueryData(key, data)
      notify({ tone: 'error', title: t('watchlists.visibilityFailed') })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] })
      queryClient.invalidateQueries({
        queryKey: ['watchlist-detail', watchlist.id],
      })
    },
  })

  useEffect(() => {
    if (open) {
      setName(watchlist.name)
      setDescription(watchlist.description || '')
      setVisibility(watchlist.visibility)
      setShareCode(watchlist.shareCode || '')
    }
  }, [open, watchlist])

  return (
    <Dialog onClose={onClose} open={open} title={t('modals.editWatchlist')}>
      <div className="grid gap-4">
        <Field
          label={t('modals.name')}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <TextArea
          label={t('modals.descriptionOptional')}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <section className="grid gap-3 rounded-md border border-border bg-muted/20 p-4">
          <WatchlistVisibilitySelector
            disabled={visibilityMutation.isPending}
            onChange={(nextVisibility) => visibilityMutation.mutate(nextVisibility)}
            value={visibility}
          />
          {visibility === 'shared' && shareCode ? <ShareCodeDisplay code={shareCode} /> : null}
        </section>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button
            className="min-w-36"
            disabled={mutation.isPending || !name.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {mutation.isPending ? t('common.loading') : t('modals.saveChanges')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
