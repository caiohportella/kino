'use client'

import type { TitleDetails, Watchlist } from '@kino/core'
import { KinoLanguage } from '@kino/core/locale-config'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { de, enUS, es, fr, it, Locale, nb, ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  Bookmark,
  Calendar,
  CalendarCheck,
  Check,
  Loader2,
  Plus,
  Search,
  Ticket,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SingleDatePicker } from '@/components/diary/single-date-picker'
import { Poster } from '@/components/kino'
import { ShareButton } from '@/components/share-button'
import { MediaModalSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WatchlistDialog } from '@/components/watchlist/watchlist-dialog'
import { useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { ANON_TITLE_ID } from '@/hooks/title/use-title-data'
import { useTranslation } from '@/lib/localization/i18n'
import { resolveLocalizedTitlePresentation } from '@/lib/localization/localized-title-presentation'
import { db, getTmdb } from '@/lib/services'
import { publishWatchlistChange } from '@/lib/watchlist/watchlist-cache-sync'
import {
  adjustWatchlistSummaryCount,
  isTitleWatchlistedFromSelection,
  setWatchlistSelection,
} from '@/lib/watchlist/watchlist-picker-state'
import { useSettingsStore } from '@/stores/settings-store'

type TitleActionsProps = {
  title: TitleDetails
  userId: string | undefined
  isWatchlisted: boolean
  hasLastWatch: boolean
  onAuthRequiredAction: () => void
  canUsePersonalActions: boolean
  shareUrl: string
  ticketsUrl: string
  showTickets: boolean
}

type WatchlistPickerTitle = Pick<TitleDetails, 'id' | 'title' | 'year' | 'coverImage'>

type TitleUserDataCache = {
  isWatchlisted: boolean
  [key: string]: unknown
}

export function TitleActions({
  title,
  userId,
  isWatchlisted,
  hasLastWatch,
  onAuthRequiredAction,
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

  const DIARY_LOCALES = {
    en: enUS,
    pt: ptBR,
    fr,
    it,
    no: nb,
    es,
    de,
  } satisfies Record<KinoLanguage, Locale>

  const today = new Date()

  const calendarStartDate = new Date(1900, 0, 1)

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:flex sm:w-auto sm:max-w-full sm:flex-wrap sm:justify-center lg:justify-start">
        <Button
          aria-label={isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}
          className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap lg:min-h-12 lg:px-5 lg:text-sm"
          disabled={Boolean(userId) && title.id === ANON_TITLE_ID}
          onClick={() => {
            if (!canUsePersonalActions) {
              onAuthRequiredAction()
              return
            }

            setWatchlistOpen(true)
          }}
        >
          <motion.span
            key={isWatchlisted ? 'watchlisted' : 'watchlist'}
            initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
            className="inline-flex shrink-0"
          >
            <Bookmark
              className={isWatchlisted ? 'text-black/70' : undefined}
              fill={isWatchlisted ? 'currentColor' : 'none'}
              size={17}
            />
          </motion.span>

          <span>{isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}</span>
        </Button>

        {hasLastWatch ? (
          <Button
            aria-label={t('title.removeHistory')}
            className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap lg:min-h-12 lg:px-5 lg:text-sm"
            disabled={diaryMutation.isPending}
            onClick={() => diaryMutation.mutate(undefined)}
            variant="secondary"
          >
            <motion.span
              key="diary-added"
              initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                duration: 0.2,
                ease: 'easeOut',
              }}
              className="inline-flex shrink-0"
            >
              <CalendarCheck size={17} />
            </motion.span>

            <span>{t('title.removeHistory')}</span>
          </Button>
        ) : (
          <SingleDatePicker
            disabled={(Boolean(userId) && title.id === ANON_TITLE_ID) || diaryMutation.isPending}
            endMonth={today}
            locale={DIARY_LOCALES[language]}
            onOpenChange={(nextOpen) => {
              if (nextOpen && !canUsePersonalActions) {
                onAuthRequiredAction()
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
            startMonth={calendarStartDate}
            trigger={
              <Button
                aria-label={t('title.diary')}
                className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap lg:min-h-12 lg:px-5 lg:text-sm"
                disabled={
                  (Boolean(userId) && title.id === ANON_TITLE_ID) || diaryMutation.isPending
                }
                variant="secondary"
              >
                <motion.span
                  key="diary-empty"
                  initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: 'easeOut',
                  }}
                  className="inline-flex shrink-0"
                >
                  <Calendar size={17} />
                </motion.span>

                <span>{t('title.diary')}</span>
              </Button>
            }
          />
        )}

        <ShareButton
          className="
            min-h-11 w-full
            min-[390px]:col-span-2
            sm:w-auto sm:min-w-32
            lg:min-h-12 lg:px-5 lg:text-sm
          "
          text={t('title.checkOut', {
            title: title.title,
          })}
          title={title.title}
          url={shareUrl}
        />

        {showTickets ? (
          <Button
            className="
            min-h-11 w-full min-[390px]:col-span-2
            sm:w-auto
            lg:min-h-12 lg:px-5 lg:text-sm
          "
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
        title={{
          id: title.id,
          title: title.title,
          year: title.year,
          coverImage: title.coverImage,
        }}
        userId={userId}
      />
    </>
  )
}

function WatchlistCoverMosaic({ coverImages }: { coverImages: string[] }) {
  const covers = coverImages.filter(Boolean).slice(0, 4)

  const image = (src: string | undefined, className: string) => {
    if (!src) {
      return null
    }

    return <img alt="" className={`h-full w-full object-cover ${className}`} src={src} />
  }

  return (
    <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/4 sm:size-18">
      {covers.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center text-kino-muted">
          <Bookmark size={19} />
        </div>
      ) : null}

      {covers.length === 1 ? image(covers[0], '') : null}

      {covers.length === 2 ? (
        <div className="grid h-full grid-cols-2">
          {image(covers[0], 'border-r border-white/10')}
          {image(covers[1], '')}
        </div>
      ) : null}

      {covers.length === 3 ? (
        <div className="grid h-full grid-cols-2 grid-rows-2">
          <div className="row-span-2 border-r border-white/10">{image(covers[0], '')}</div>

          <div className="border-b border-white/10">{image(covers[1], '')}</div>

          <div>{image(covers[2], '')}</div>
        </div>
      ) : null}

      {covers.length >= 4 ? (
        <div className="grid h-full grid-cols-2 grid-rows-2">
          <div className="border-b border-r border-white/10">{image(covers[0], '')}</div>

          <div className="border-b border-white/10">{image(covers[1], '')}</div>

          <div className="border-r border-white/10">{image(covers[2], '')}</div>

          <div>{image(covers[3], '')}</div>
        </div>
      ) : null}
    </div>
  )
}

function WatchlistPicker({
  open,
  onClose,
  title,
  userId,
}: {
  open: boolean
  onClose: () => void
  title: WatchlistPickerTitle
  userId: string | undefined
}) {
  const titleId = title.id
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingWatchlistIds, setPendingWatchlistIds] = useState(() => new Set<string>())

  const pickerQueryKey = ['watchlist-picker', userId, titleId] as const

  const titleUserDataQueryKey = ['title-user-data', titleId, userId] as const

  const query = useQuery({
    queryKey: pickerQueryKey,
    queryFn: async () => {
      const watchlists = await db.getUserWatchlists()
      const watchlistIds = watchlists.map((watchlist) => watchlist.id)

      const picker = await db.getWatchlistPickerData(watchlistIds, titleId)

      return {
        watchlists,
        summaries: picker.summaries,
        selected: new Map(picker.selected.map((row) => [row.watchlist_id, row.added_by])),
      }
    },
    enabled: open && Boolean(userId),
  })

  const allWatchlists = query.data?.watchlists ?? []

  const watchlistCoverRequests = useMemo(
    () =>
      Object.values(query.data?.summaries ?? {}).flatMap((summary) =>
        summary.coverItems.map((item) => ({
          tmdbId: item.tmdbId,
          type: item.type,
        }))
      ),
    [query.data?.summaries]
  )

  const localizedWatchlistCovers = useLocalizedTitles(watchlistCoverRequests)

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()

  const filteredWatchlists = normalizedSearchQuery
    ? allWatchlists.filter((watchlist) => {
        const searchableText = [watchlist.name, watchlist.description]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()

        return searchableText.includes(normalizedSearchQuery)
      })
    : allWatchlists

  const mutation = useMutation({
    mutationFn: async ({
      watchlist,
      action,
    }: {
      watchlist: Watchlist
      action: 'add' | 'remove'
    }) => {
      if (action === 'remove') {
        await db.removeFromWatchlist(watchlist.id, titleId)
        return
      }

      await db.addToWatchlist(watchlist.id, titleId)
    },

    onMutate: async ({ watchlist, action }) => {
      setPendingWatchlistIds((current) => {
        const next = new Set(current)
        next.add(watchlist.id)
        return next
      })

      await queryClient.cancelQueries({
        queryKey: pickerQueryKey,
      })

      const current = queryClient.getQueryData<typeof query.data>(pickerQueryKey)

      const previousContributorId = current?.selected.get(watchlist.id)

      let nextIsWatchlisted: boolean | undefined

      queryClient.setQueryData<typeof query.data>(pickerQueryKey, (cached) => {
        if (!cached) {
          return cached
        }

        const nextSelected = setWatchlistSelection(
          cached.selected,
          watchlist.id,
          action === 'add' ? (userId ?? null) : null
        )

        nextIsWatchlisted = isTitleWatchlistedFromSelection(nextSelected)

        return {
          ...cached,
          selected: nextSelected,
          summaries: adjustWatchlistSummaryCount(
            cached.summaries,
            watchlist.id,
            action === 'add' ? 1 : -1
          ),
        }
      })

      if (nextIsWatchlisted !== undefined) {
        queryClient.setQueryData(
          titleUserDataQueryKey,
          (cached: TitleUserDataCache | undefined) => {
            if (!cached) {
              return cached
            }

            return {
              ...cached,
              isWatchlisted: nextIsWatchlisted,
            }
          }
        )
      }

      return {
        previousContributorId,
      }
    },

    onError: (_error, { watchlist, action }, context) => {
      let rolledBackIsWatchlisted: boolean | undefined

      queryClient.setQueryData<typeof query.data>(pickerQueryKey, (cached) => {
        if (!cached) {
          return cached
        }

        const rolledBackSelected = setWatchlistSelection(
          cached.selected,
          watchlist.id,
          context?.previousContributorId ?? null
        )

        rolledBackIsWatchlisted = isTitleWatchlistedFromSelection(rolledBackSelected)

        return {
          ...cached,
          selected: rolledBackSelected,
          summaries: adjustWatchlistSummaryCount(
            cached.summaries,
            watchlist.id,
            action === 'add' ? -1 : 1
          ),
        }
      })

      if (rolledBackIsWatchlisted !== undefined) {
        queryClient.setQueryData(
          titleUserDataQueryKey,
          (cached: TitleUserDataCache | undefined) => {
            if (!cached) {
              return cached
            }

            return {
              ...cached,
              isWatchlisted: rolledBackIsWatchlisted,
            }
          }
        )
      }
    },

    onSuccess: (_result, { watchlist }) => {
      publishWatchlistChange(watchlist.id)

      void queryClient.invalidateQueries({
        queryKey: titleUserDataQueryKey,
        refetchType: 'none',
      })

      void queryClient.invalidateQueries({
        queryKey: ['watchlists', userId],
      })

      void queryClient.invalidateQueries({
        queryKey: ['profile', userId],
      })

      void queryClient.invalidateQueries({
        queryKey: ['public-watchlists'],
      })
    },

    onSettled: (_result, _error, { watchlist }) => {
      setPendingWatchlistIds((current) => {
        const next = new Set(current)
        next.delete(watchlist.id)
        return next
      })

      void queryClient.invalidateQueries({
        queryKey: pickerQueryKey,
      })
    },
  })

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSearchQuery('')
            onClose()
          }
        }}
        open={open && !createOpen}
      >
        <DialogContent
          className="
          flex
          max-h-[calc(100dvh-1rem)]
          w-[calc(100vw-0.75rem)]
          max-w-4xl
          flex-col
          gap-0
          overflow-hidden
          p-0
          sm:w-[calc(100vw-2rem)]
        "
        >
          <div className="px-5 pb-6 pt-5 sm:px-8 sm:pt-7">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {t('modals.selectWatchlist', {
                  defaultValue: 'Select list',
                })}
              </DialogTitle>

              <DialogDescription className="sr-only">
                {t('modals.watchlistSelectorHint', {
                  defaultValue: 'Select lists to add this title to.',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex items-center gap-5 rounded-xl border border-white/10 bg-black/15 p-4 sm:p-5">
              <div className="w-14 shrink-0 overflow-hidden rounded-lg sm:w-16">
                <Poster className="w-full" src={title.coverImage} title={title.title} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-kino-muted">
                  {t('modals.addingTitle', {
                    defaultValue: 'Adding',
                  })}
                </p>

                <p className="mt-1 truncate text-lg font-semibold text-kino-text sm:text-xl">
                  {title.title}
                  {title.year ? (
                    <span className="font-normal text-kino-muted"> ({title.year})</span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10" />

          <div className="flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-8">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-kino-muted"
                size={17}
              />

              <input
                aria-label={t('modals.searchWatchlists', {
                  defaultValue: 'Search your lists',
                })}
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/15 pl-11 pr-4 text-sm text-kino-text outline-none transition-colors placeholder:text-kino-muted focus:border-white/20 focus:bg-white/3"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('modals.searchWatchlists', {
                  defaultValue: 'Search your lists',
                })}
                type="search"
                value={searchQuery}
              />
            </div>

            <button
              className="mt-4 flex w-full items-center gap-4 rounded-xl border border-dashed border-white/15 px-4 py-4 text-left transition-colors hover:border-white/25 hover:bg-white/3"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/20 text-kino-muted">
                <Plus size={18} />
              </span>

              <span className="font-semibold text-kino-text">
                {t('watchlists.createWatchlist', {
                  defaultValue: 'Create new list',
                })}
              </span>
            </button>

            <div className="my-4 shrink-0 border-t border-white/8" />

            <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
              {query.isLoading ? <MediaModalSkeleton label={t('common.loading')} /> : null}

              <div className="grid gap-1">
                {filteredWatchlists.map((watchlist) => {
                  const contributorId = query.data?.selected.get(watchlist.id)
                  const active = Boolean(contributorId)
                  const canRemove = contributorId === userId
                  const summary = query.data?.summaries[watchlist.id]
                  const titleCount = summary?.titleCount ?? 0
                  const pending = pendingWatchlistIds.has(watchlist.id)
                  const coverImages = (summary?.coverItems ?? [])
                    .map((item) => {
                      const localized = resolveLocalizedTitlePresentation({
                        ...localizedWatchlistCovers,
                        request: {
                          tmdbId: item.tmdbId,
                          type: item.type,
                        },
                        unknownTitle: '',
                      })

                      if (localized.status === 'ready' && localized.posterPath) {
                        return getTmdb().getImageUrl(localized.posterPath, 'w300')
                      }

                      return item.fallbackCoverImage
                    })
                    .filter((cover): cover is string => Boolean(cover))

                  return (
                    <button
                      className="
                        flex w-full items-center justify-between
                        gap-6 rounded-xl px-3 py-3
                        text-left transition-colors
                        hover:bg-white/4
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                      disabled={pending || (active && !canRemove)}
                      key={watchlist.id}
                      onClick={() => {
                        if (pending) {
                          return
                        }

                        if (contributorId === userId) {
                          mutation.mutate({
                            watchlist,
                            action: 'remove',
                          })
                          return
                        }

                        if (!contributorId) {
                          mutation.mutate({
                            watchlist,
                            action: 'add',
                          })
                        }
                      }}
                      title={
                        active && !canRemove ? t('watchlists.onlyContributorCanRemove') : undefined
                      }
                      type="button"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-5">
                        <WatchlistCoverMosaic coverImages={coverImages} />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-kino-text">{watchlist.name}</p>

                          {watchlist.description ? (
                            <p className="mt-0.5 line-clamp-1 text-sm text-kino-muted">
                              {watchlist.description}
                            </p>
                          ) : null}

                          <p
                            className={`text-xs text-kino-muted/70 ${
                              watchlist.description ? 'mt-1' : 'mt-0.5'
                            }`}
                          >
                            {titleCount === 1
                              ? t('watchlists.oneTitle', {
                                  defaultValue: '1 title',
                                })
                              : t('watchlists.titleCount', {
                                  count: titleCount,
                                  defaultValue: '{{count}} titles',
                                })}
                          </p>
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          pending
                            ? 'border-white/20 bg-white/5 text-kino-muted'
                            : active
                              ? 'border-kino-accent bg-kino-accent text-black'
                              : 'border-white/20 bg-transparent text-transparent'
                        }`}
                      >
                        {pending ? (
                          <Loader2 aria-hidden="true" className="animate-spin" size={16} />
                        ) : (
                          <Check aria-hidden="true" size={17} strokeWidth={2.5} />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              {!query.isLoading && allWatchlists.length === 0 ? (
                <div className="py-8 text-center text-sm text-kino-muted">
                  {t('modals.noWatchlistsFound', {
                    defaultValue: 'No watchlists found.',
                  })}
                </div>
              ) : null}

              {!query.isLoading && allWatchlists.length > 0 && filteredWatchlists.length === 0 ? (
                <div className="py-8 text-center text-sm text-kino-muted">
                  {t('modals.noMatchingWatchlists', {
                    defaultValue: 'No lists match your search.',
                  })}
                </div>
              ) : null}
            </div>

            {!query.isLoading && allWatchlists.length === 0 ? (
              <div className="py-8 text-center text-sm text-kino-muted">
                {t('modals.noWatchlistsFound', {
                  defaultValue: 'No watchlists found.',
                })}
              </div>
            ) : null}

            {!query.isLoading && allWatchlists.length > 0 && filteredWatchlists.length === 0 ? (
              <div className="py-8 text-center text-sm text-kino-muted">
                {t('modals.noMatchingWatchlists', {
                  defaultValue: 'No lists match your search.',
                })}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/10 px-5 py-5 sm:px-8">
            <Button
              className="w-full"
              onClick={() => {
                setSearchQuery('')
                onClose()
              }}
              size="lg"
            >
              {t('common.done', {
                defaultValue: 'Done',
              })}
            </Button>
          </div>
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
