'use client'

import { activityQueryKeys, formatDate } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clipboard, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ProtectedContentGate } from '@/components/auth/protected-content-gate'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState } from '@/components/kino'
import { PageHeader } from '@/components/layout/page-header'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field } from '@/components/ui/labeled-field'
import { WatchlistDialog } from '@/components/watchlist/watchlist-dialog'
import { WatchlistVisibilityBadge } from '@/components/watchlist/watchlist-sharing'
import { useTranslation } from '@/lib/i18n'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { watchlistPath } from '@/lib/routes'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export default function WatchlistsPage() {
  const user = useAuthStore((state) => state.user)
  const resolution = useAuthStore((state) => state.resolution)
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { notify } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['watchlists', user?.id],
    queryFn: () => db.getUserWatchlists(),
    enabled: Boolean(user),
  })
  const joinMutation = useMutation({
    mutationFn: () => db.joinWatchlistByCode(shareCode),
    onSuccess: () => {
      setShareCode('')
      setJoinError(null)
      notify({ tone: 'success', title: t('common.joinedSuccessfully') })
      queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('common.failedToJoin')
      setJoinError(message)
      notify({ tone: 'error', title: t('common.failedToJoin'), body: message })
    },
  })

  return (
    <ProtectedContentGate
      authLoadingFallback={<WatchlistsSkeleton label={t('common.loading')} />}
      emptyFallback={
        <div className="content-frame">
          <PageHeader
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus size={16} />
                {t('watchlists.createWatchlist')}
              </Button>
            }
            eyebrow={t('watchlists.title')}
            title={t('watchlists.title')}
          />
          <Card className="mb-6 grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <Field
              error={joinError || undefined}
              label={t('modals.joinWatchlist')}
              onChange={(event) => setShareCode(event.target.value.toUpperCase())}
              placeholder="ABCD1234"
              value={shareCode}
            />
            <Button
              disabled={!shareCode.trim() || joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
              variant="secondary"
            >
              <Clipboard size={16} />
              {t('modals.join')}
            </Button>
          </Card>
          <EmptyState
            action={
              <Button onClick={() => setDialogOpen(true)}>{t('watchlists.createWatchlist')}</Button>
            }
            body={t('watchlists.emptyState')}
            illustrationLabel={t('emptyStates.watchlistIllustration')}
            title={t('watchlists.title')}
            variant="watchlist"
          />
          <WatchlistDialog
            onClose={() => setDialogOpen(false)}
            onSaved={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['watchlists', user!.id] }),
                invalidateProfileMutation(queryClient, {
                  kind: 'watchlist',
                  profileId: user!.id,
                  visibilityScope: { kind: 'authenticated', userId: user!.id },
                }),
                queryClient.invalidateQueries({ queryKey: activityQueryKeys.all }),
                queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
              ])
            }}
            open={dialogOpen}
          />
        </div>
      }
      errorFallback={
        <EmptyState body={t('common.tryAgain')} title={t('common.failed')} variant="watchlist" />
      }
      pageLoadingFallback={<WatchlistsSkeleton label={t('common.loading')} />}
      pageStatus={
        query.isPending
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
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus size={16} />
              {t('watchlists.createWatchlist')}
            </Button>
          }
          eyebrow={t('watchlists.title')}
          title={t('watchlists.title')}
        />

        <Card className="mb-6 grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field
            error={joinError || undefined}
            label={t('modals.joinWatchlist')}
            onChange={(event) => setShareCode(event.target.value.toUpperCase())}
            placeholder="ABCD1234"
            value={shareCode}
          />
          <Button
            disabled={!shareCode.trim() || joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
            variant="secondary"
          >
            <Clipboard size={16} />
            {t('modals.join')}
          </Button>
        </Card>

        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(query.data || []).map((watchlist) => (
            <Link
              className="min-w-0 max-w-full"
              href={watchlistPath(watchlist.id, watchlist.name)}
              key={watchlist.id}
            >
              <Card className="h-full w-full min-w-0 max-w-full p-5 transition hover:border-kino-accent/60 hover:bg-white/4">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-kino-text">
                      {watchlist.name}
                    </h2>
                    {watchlist.description ? (
                      <p className="mt-2 line-clamp-2 wrap-break-word text-sm leading-6 text-kino-muted">
                        {watchlist.description}
                      </p>
                    ) : null}
                  </div>
                  <WatchlistVisibilityBadge visibility={watchlist.visibility} />
                </div>
                <div className="mt-6 border-t border-white/10 pt-4 text-xs font-semibold text-kino-muted">
                  {t('common.lastUpdated')} {formatDate(watchlist.updatedAt)}
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <WatchlistDialog
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            void Promise.all([
              queryClient.invalidateQueries({ queryKey: ['watchlists', user!.id] }),
              invalidateProfileMutation(queryClient, {
                kind: 'watchlist',
                profileId: user!.id,
                visibilityScope: { kind: 'authenticated', userId: user!.id },
              }),
              queryClient.invalidateQueries({ queryKey: activityQueryKeys.all }),
              queryClient.invalidateQueries({ queryKey: ['public-watchlists'] }),
            ])
          }}
          open={dialogOpen}
        />
      </div>
    </ProtectedContentGate>
  )
}
