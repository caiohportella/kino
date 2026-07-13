'use client'

import { EmptyState } from '@/components/kino'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field } from '@/components/ui/labeled-field'
import { formatDate } from '@kino/core'
import { Clipboard, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { ProtectedEmpty } from '@/components/protected-empty'
import { useToast } from '@/components/toast-provider'
import { WatchlistDialog } from '@/components/watchlist-dialog'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export default function WatchlistsPage() {
  const user = useAuthStore((state) => state.user)
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

  if (!user) {
    return <ProtectedEmpty />
  }

  return (
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

      {query.isLoading ? <WatchlistsSkeleton label={t('common.loading')} /> : null}

      {!query.isLoading && query.data?.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setDialogOpen(true)}>{t('watchlists.createWatchlist')}</Button>
          }
          body={t('watchlists.emptyState')}
          illustrationLabel={t('emptyStates.watchlistIllustration')}
          title={t('watchlists.title')}
          variant="watchlist"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(query.data || []).map((watchlist) => (
          <Link href={`/watchlists/${watchlist.id}`} key={watchlist.id}>
            <Card className="h-full p-5 transition hover:border-kino-accent/60 hover:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-kino-text">
                    {watchlist.name}
                  </h2>
                  {watchlist.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-kino-muted">
                      {watchlist.description}
                    </p>
                  ) : null}
                </div>
                {watchlist.isShared ? (
                  <span className="rounded-md bg-kino-accent/15 px-3 py-1 text-xs font-semibold text-kino-accent">
                    {t('watchlists.shared')}
                  </span>
                ) : null}
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
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['watchlists', user.id] })}
        open={dialogOpen}
      />
    </div>
  )
}
