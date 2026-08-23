'use client'

import { activityQueryKeys, UserProfile, UserWatchlistSummary } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProtectedContentGate } from '@/components/auth/protected-content-gate'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState } from '@/components/kino'
import { PageHeader } from '@/components/layout/page-header'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { JoinWatchlistControl } from '@/components/watchlist/join-watchlist-control'
import { WatchlistCard } from '@/components/watchlist/watchlist-card'
import { WatchlistDialog } from '@/components/watchlist/watchlist-dialog'
import { useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { useTranslation } from '@/lib/localization/i18n'
import { invalidateProfileMutation } from '@/lib/profile/profile-invalidation'
import { db, getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { applyLocalizedWatchlistPreviewTitles } from '@/lib/watchlist/watchlist-card'
import { useAuthStore } from '@/stores/auth-store'

export default function WatchlistsPage() {
  const user = useAuthStore((state) => state.user)
  const resolution = useAuthStore((state) => state.resolution)
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { notify } = useToast()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [joinExpanded, setJoinExpanded] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['watchlists', user?.id],
    queryFn: () => db.getUserWatchlists(),
    enabled: Boolean(user),
  })

  const previewTitleRequests = useMemo(
    () =>
      (query.data ?? []).flatMap((watchlist) =>
        watchlist.previewTitles.map((title) => ({
          tmdbId: title.tmdbId,
          type: title.type,
        }))
      ),
    [query.data]
  )

  const localizedPreviewTitles = useLocalizedTitles(previewTitleRequests)

  const localizedWatchlists = useMemo(() => {
    const tmdb = getTmdb()

    return applyLocalizedWatchlistPreviewTitles(
      query.data ?? [],
      localizedPreviewTitles.data,
      (posterPath) => tmdb.getImageUrl(posterPath, 'w500')
    )
  }, [query.data, localizedPreviewTitles.data])

  const joinMutation = useMutation({
    mutationFn: () => db.joinWatchlistByCode(shareCode),

    onSuccess: () => {
      setShareCode('')
      setJoinError(null)
      setJoinExpanded(false)

      notify({
        tone: 'success',
        title: t('common.joinedSuccessfully'),
      })

      void queryClient.invalidateQueries({
        queryKey: ['watchlists', user?.id],
      })
    },

    onError: (error) => {
      const message = error instanceof Error ? error.message : t('common.failedToJoin')

      setJoinError(message)

      notify({
        tone: 'error',
        title: t('common.failedToJoin'),
        body: message,
      })
    },
  })

  const handleWatchlistSaved = () => {
    if (!user) return

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['watchlists', user.id],
      }),
      invalidateProfileMutation(queryClient, {
        kind: 'watchlist',
        profileId: user.id,
        visibilityScope: {
          kind: 'authenticated',
          userId: user.id,
        },
      }),
      queryClient.invalidateQueries({
        queryKey: activityQueryKeys.all,
      }),
      queryClient.invalidateQueries({
        queryKey: ['public-watchlists'],
      }),
    ])
  }

  const renderHeaderActions = () => (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <JoinWatchlistControl
        error={joinError ?? undefined}
        expanded={joinExpanded}
        onChange={(value) => {
          setShareCode(value)

          if (joinError) {
            setJoinError(null)
          }
        }}
        onCollapse={() => {
          setJoinExpanded(false)
          setShareCode('')
          setJoinError(null)
        }}
        onExpand={() => setJoinExpanded(true)}
        onJoin={() => joinMutation.mutate()}
        pending={joinMutation.isPending}
        value={shareCode}
      />

      <Button
        aria-label={t('watchlists.createWatchlist')}
        className={cn(
          'shrink-0 overflow-hidden transition-[padding,gap] duration-500',
          'ease-[cubic-bezier(0.22,1,0.36,1)]',
          joinExpanded ? 'gap-0 px-3 sm:gap-2 sm:px-4' : 'gap-2 px-4'
        )}
        onClick={() => setCreateDialogOpen(true)}
      >
        <Plus className="shrink-0" size={16} />

        <span
          className={cn(
            'overflow-hidden whitespace-nowrap',
            'transition-[max-width,opacity,transform,margin] duration-500',
            'ease-[cubic-bezier(0.22,1,0.36,1)]',
            joinExpanded
              ? 'ml-0 max-w-0 -translate-x-2 opacity-0 sm:max-w-40 sm:translate-x-0 sm:opacity-100'
              : 'max-w-40 translate-x-0 opacity-100'
          )}
        >
          {t('watchlists.createWatchlist')}
        </span>
      </Button>
    </div>
  )

  const renderDialogs = () => (
    <WatchlistDialog
      onClose={() => setCreateDialogOpen(false)}
      onSaved={handleWatchlistSaved}
      open={createDialogOpen}
    />
  )

  const isPreviewLocalizationPending =
    previewTitleRequests.length > 0 && localizedPreviewTitles.isPending

  return (
    <ProtectedContentGate
      authLoadingFallback={<WatchlistsSkeleton label={t('common.loading')} />}
      emptyFallback={
        <div className="content-frame">
          <PageHeader
            action={renderHeaderActions()}
            title={t('watchlists.headerPhrase', {
              defaultValue: "Save it now. Watch it when you're ready.",
            })}
          />

          <EmptyState
            action={
              <Button onClick={() => setCreateDialogOpen(true)}>
                {t('watchlists.createWatchlist')}
              </Button>
            }
            body={t('watchlists.emptyState')}
            illustrationLabel={t('emptyStates.watchlistIllustration')}
            title={t('watchlists.title')}
            variant="watchlist"
          />

          {renderDialogs()}
        </div>
      }
      errorFallback={
        <EmptyState body={t('common.tryAgain')} title={t('common.failed')} variant="watchlist" />
      }
      pageLoadingFallback={<WatchlistsSkeleton label={t('common.loading')} />}
      pageStatus={
        query.isPending || isPreviewLocalizationPending
          ? 'loading'
          : query.isError
            ? 'error'
            : query.data?.length === 0
              ? 'empty'
              : 'content'
      }
      resolution={resolution}
      unauthenticatedFallback={<ProtectedEmpty />}
    >
      <div className="content-frame">
        <PageHeader
          action={renderHeaderActions()}
          title={t('watchlists.headerPhrase', {
            defaultValue: "Save it now. Watch it when you're ready.",
          })}
        />

        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {localizedWatchlists.map((watchlist) => (
            <WatchlistCard key={watchlist.id} watchlist={watchlist} />
          ))}
        </div>

        {renderDialogs()}
      </div>
    </ProtectedContentGate>
  )
}
