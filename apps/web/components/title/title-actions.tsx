'use client'

import type { TitleDetails, Watchlist } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, fr, it, nb, ptBR } from 'date-fns/locale'
import { BookmarkPlus, CalendarCheck, ChevronDown, Plus, Ticket } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ShareButton } from '@/components/share-button'
import { SingleDatePicker } from '@/components/single-date-picker'
import { MediaModalSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SplitButton, SplitButtonMain, SplitButtonSecondary } from '@/components/ui/split-button'
import { WatchlistDialog } from '@/components/watchlist-dialog'
import { ANON_TITLE_ID } from '@/hooks/title/use-title-data'
import { useTranslation } from '@/lib/i18n'
import { db } from '@/lib/services'
import { publishWatchlistChange } from '@/lib/watchlist-cache-sync'
import { useSettingsStore } from '@/stores/settings-store'

type TitleActionsProps = {
  title: TitleDetails
  userId: string | undefined
  isWatchlisted: boolean
  hasLastWatch: boolean
  onAuthRequired: () => void
  canUsePersonalActions: boolean
  shareUrl: string
  ticketsUrl: string
  showTickets: boolean
}

export function TitleActions({
  title,
  userId,
  isWatchlisted,
  hasLastWatch,
  onAuthRequired,
  canUsePersonalActions,
  shareUrl,
  ticketsUrl,
  showTickets,
}: TitleActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [diaryCalendarOpen, setDiaryCalendarOpen] = useState(false)
  const [diaryDate, setDiaryDate] = useState(() => new Date())
  const language = useSettingsStore((state) => state.language)

  const diaryMutation = useMutation({
    mutationFn: async (watchedAt?: Date) => {
      if (hasLastWatch && !watchedAt) {
        await db.removeMediaHistory(title.id, title.type)
      } else {
        await db.addWatchDiaryEntry(title.id, watchedAt || new Date(), 'first-time')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', title.id, userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['diary', userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['profile', userId],
      })

      setDiaryCalendarOpen(false)
      setDiaryDate(new Date())
    },
  })

  const diaryLocale = { en: enUS, fr, it, no: nb, pt: ptBR }[language] || enUS

  const today = new Date()

  const earliestDiaryDate = new Date(Math.max(title.year || 1900, 1900), 0, 1)

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:flex sm:w-auto sm:max-w-full sm:flex-wrap sm:justify-center lg:justify-start">
        <Button
          aria-label={isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}
          className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap"
          disabled={Boolean(userId) && title.id === ANON_TITLE_ID}
          onClick={() => {
            if (!canUsePersonalActions) {
              onAuthRequired()
              return
            }

            setWatchlistOpen(true)
          }}
        >
          <BookmarkPlus fill={isWatchlisted ? 'currentColor' : 'none'} size={17} />

          <span>{isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}</span>
        </Button>

        {hasLastWatch ? (
          <Button
            aria-label={t('title.removeHistory')}
            className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap"
            disabled={diaryMutation.isPending}
            onClick={() => diaryMutation.mutate(undefined)}
            variant="secondary"
          >
            <CalendarCheck fill="currentColor" size={17} />
            <span>{t('title.removeHistory')}</span>
          </Button>
        ) : (
          <SplitButton aria-label={t('title.diary')} className="w-full sm:w-auto sm:min-w-36">
            <SplitButtonMain
              disabled={(Boolean(userId) && title.id === ANON_TITLE_ID) || diaryMutation.isPending}
              onClick={() => {
                if (!canUsePersonalActions) {
                  onAuthRequired()
                  return
                }

                diaryMutation.mutate(new Date())
              }}
            >
              <CalendarCheck />
              <span className="truncate">{t('title.diary')}</span>
            </SplitButtonMain>

            <SingleDatePicker
              disabled={diaryMutation.isPending}
              endMonth={today}
              locale={diaryLocale}
              onOpenChange={(nextOpen) => {
                if (nextOpen && !canUsePersonalActions) {
                  onAuthRequired()
                  return
                }

                setDiaryCalendarOpen(nextOpen)
              }}
              onSelect={(date) => {
                if (diaryMutation.isPending) {
                  return
                }

                const localDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)

                setDiaryDate(localDay)
                diaryMutation.mutate(localDay)
              }}
              open={diaryCalendarOpen}
              selected={diaryDate}
              startMonth={earliestDiaryDate}
              trigger={
                <SplitButtonSecondary aria-label={t('title.chooseDiaryDate')}>
                  <ChevronDown />
                </SplitButtonSecondary>
              }
            />
          </SplitButton>
        )}

        <ShareButton
          className="min-h-11 w-full min-[390px]:col-span-2 sm:w-auto sm:min-w-32"
          text={t('title.checkOut', {
            title: title.title,
          })}
          title={title.title}
          url={shareUrl}
        />

        {showTickets ? (
          <Button
            className="min-h-11 w-full min-[390px]:col-span-2 sm:w-auto"
            render={
              <Link href={ticketsUrl} rel="noreferrer" target="_blank">
                <Ticket size={17} />
                {t('title.buyCinemaTickets')}
              </Link>
            }
            variant="secondary"
          />
        ) : null}
      </div>

      <WatchlistPicker
        onClose={() => setWatchlistOpen(false)}
        open={watchlistOpen}
        titleId={title.id}
        userId={userId}
      />
    </>
  )
}

function WatchlistPicker({
  open,
  onClose,
  titleId,
  userId,
}: {
  open: boolean
  onClose: () => void
  titleId: string
  userId: string | undefined
}) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)

  const query = useQuery({
    queryKey: ['watchlist-picker', userId, titleId],
    queryFn: async () => {
      const [watchlists, selectedRows] = await Promise.all([
        db.getUserWatchlists(),
        db.getWatchlistTitleContributors(titleId),
      ])

      return {
        watchlists,
        selected: new Map(selectedRows.map((row) => [row.watchlist_id, row.added_by])),
      }
    },
    enabled: open && Boolean(userId),
  })

  const mutation = useMutation({
    mutationFn: async (watchlist: Watchlist) => {
      const contributorId = query.data?.selected.get(watchlist.id)

      if (contributorId === userId) {
        await db.removeFromWatchlist(watchlist.id, titleId)
      } else if (!contributorId) {
        await db.addToWatchlist(watchlist.id, titleId)
      }
    },
    onSuccess: (_result, watchlist) => {
      publishWatchlistChange(watchlist.id)

      queryClient.invalidateQueries({
        queryKey: ['watchlist-picker', userId, titleId],
      })
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', titleId, userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['watchlists', userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['profile', userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['public-watchlists'],
      })
    },
  })

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose()
          }
        }}
        open={open && !createOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('modals.selectWatchlist')}</DialogTitle>

            <DialogDescription>{t('modals.watchlistSelectorHint')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-white/10 bg-white/3 p-3">
            <span className="text-sm font-semibold text-kino-text">
              {t('watchlists.createWatchlist')}
            </span>

            <Button
              aria-label={t('watchlists.createWatchlist')}
              className="shrink-0"
              onClick={() => setCreateOpen(true)}
              size="icon"
              title={t('watchlists.createWatchlist')}
              variant="secondary"
            >
              <Plus size={17} />
            </Button>
          </div>

          {query.isLoading ? <MediaModalSkeleton label={t('common.loading')} /> : null}

          <div className="grid gap-3">
            {(query.data?.watchlists || []).map((watchlist) => {
              const contributorId = query.data?.selected.get(watchlist.id)
              const active = Boolean(contributorId)
              const canRemove = contributorId === userId

              return (
                <button
                  className={`flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${
                    active
                      ? 'border-kino-accent bg-kino-accent/15 text-kino-text'
                      : 'border-white/10 bg-white/4 text-kino-muted hover:text-kino-text'
                  }`}
                  disabled={mutation.isPending || (active && !canRemove)}
                  key={watchlist.id}
                  onClick={() => mutation.mutate(watchlist)}
                  title={
                    active && !canRemove ? t('watchlists.onlyContributorCanRemove') : undefined
                  }
                  type="button"
                >
                  <span>
                    <span className="block font-bold">{watchlist.name}</span>

                    {watchlist.description ? (
                      <span className="text-sm">{watchlist.description}</span>
                    ) : null}
                  </span>

                  <span className="text-sm font-bold">
                    {active ? t('common.added') : t('common.add')}
                  </span>
                </button>
              )
            })}
          </div>

          {!query.isLoading && query.data?.watchlists.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 bg-white/3 p-4 text-sm text-kino-muted">
              <p>{t('modals.noWatchlistsFound')}</p>

              <Button
                className="mt-3"
                onClick={() => setCreateOpen(true)}
                size="sm"
                variant="secondary"
              >
                <Plus size={15} />
                {t('watchlists.createWatchlist')}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <WatchlistDialog
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({
            queryKey: ['watchlist-picker', userId, titleId],
          })

          if (userId) {
            queryClient.invalidateQueries({
              queryKey: ['watchlists', userId],
            })
          }
        }}
        open={createOpen}
      />
    </>
  )
}
