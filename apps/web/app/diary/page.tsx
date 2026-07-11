'use client'

import type { WatchType } from '@kino/core'
import { formatDate, groupDiaryByMonth } from '@kino/core'
import { EmptyState } from '@kino/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MoreHorizontal, RotateCcw, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AppPagination } from '@/components/app-pagination'
import { type DiaryFilterState, DiaryFilters } from '@/components/diary-filters'
import { DiarySkeleton } from '@/components/skeletons/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { ProtectedEmpty } from '@/components/protected-empty'
import { RatingStars } from '@/components/rating-stars'
import { useToast } from '@/components/toast-provider'
import {
  AlertDialog,
  AlertDialogButtonAction,
  AlertDialogButtonCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { db, getTmdb } from '@/lib/services'
import type { LocalizedTitleMap } from '@/lib/use-localized-titles'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

type DiaryEntry = Awaited<ReturnType<typeof db.getDiaryEntries>>[number]
const DIARY_ITEMS_PER_PAGE = 30

export default function DiaryPage() {
  const user = useAuthStore((state) => state.user)
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null)
  const [page, setPage] = useState(1)
  const diaryActions = useDiaryEntryActions(user?.id)

  const query = useQuery({
    queryKey: ['diary', user?.id],
    queryFn: () => db.getDiaryEntries(user!.id),
    enabled: Boolean(user),
  })
  const entries = query.data || []
  const filterState = useMemo<DiaryFilterState>(
    () => ({
      rating: searchParams.get('rating') || 'any',
      watchType: searchParams.get('watchType') || 'any',
      year: searchParams.get('year') || 'any',
      decade: searchParams.get('decade') || 'any',
      genre: searchParams.get('genre') || 'any',
      sort: searchParams.get('sort') || 'watched-desc',
    }),
    [searchParams]
  )
  const diaryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.titleId, (counts.get(entry.titleId) || 0) + 1)
    return counts
  }, [entries])
  const filteredEntries = useMemo(
    () => filterAndSortDiaryEntries(entries, filterState, diaryCounts),
    [entries, filterState, diaryCounts]
  )
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / DIARY_ITEMS_PER_PAGE))
  const paginatedEntries = filteredEntries.slice(
    (page - 1) * DIARY_ITEMS_PER_PAGE,
    page * DIARY_ITEMS_PER_PAGE
  )
  const localizedTitles = useLocalizedTitles(
    paginatedEntries.map((entry) => ({ tmdbId: entry.tmdbId, type: entry.type }))
  )

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  const years = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => String(new Date(entry.watchedAt).getFullYear())))
      ).sort((left, right) => Number(right) - Number(left)),
    [entries]
  )
  const genres = useMemo(() => {
    const uniqueGenres = new Map<number, string>()
    for (const entry of entries) {
      for (const genre of entry.genres) uniqueGenres.set(genre.id, genre.name)
    }
    return Array.from(uniqueGenres, ([id, name]) => ({
      label: t(`genres.${id}`, { defaultValue: name }),
      value: String(id),
    })).sort((left, right) => left.label.localeCompare(right.label, language))
  }, [entries, language, t])
  const activeFilterCount =
    Number(filterState.rating !== 'any') +
    Number(filterState.watchType !== 'any') +
    Number(filterState.year !== 'any') +
    Number(filterState.decade !== 'any') +
    Number(filterState.genre !== 'any') +
    Number(filterState.sort !== 'watched-desc')

  function updateFilter(key: keyof DiaryFilterState, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    const defaultValue = key === 'sort' ? 'watched-desc' : 'any'
    if (value === defaultValue) params.delete(key)
    else params.set(key, value)
    setPage(1)
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    })
  }

  function resetFilters() {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['rating', 'watchType', 'year', 'decade', 'genre', 'sort']) {
      params.delete(key)
    }
    setPage(1)
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    })
  }

  if (!user) {
    return <ProtectedEmpty />
  }

  if (query.isLoading) return <DiarySkeleton label={t('common.loading')} />

  const sections = groupDiaryByMonth(paginatedEntries, language)
  const localizedTitleMap = localizedTitles.data || {}

  return (
    <div className="content-frame">
      <PageHeader eyebrow={t('diary.title')} title={t('diary.watchDiary')} />

      {entries.length > 0 ? (
        <DiaryFilters
          activeCount={activeFilterCount}
          genres={genres}
          onChange={updateFilter}
          onReset={resetFilters}
          state={filterState}
          years={years}
        />
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          action={
            <Link href="/search">
              <Button>{t('search.title')}</Button>
            </Link>
          }
          body={t('emptyStates.diaryBody')}
          illustrationLabel={t('emptyStates.diaryIllustration')}
          title={t('emptyStates.diaryTitle')}
          variant="diary"
        />
      ) : sections.length === 0 ? (
        <EmptyState
          action={<Button onClick={resetFilters}>{t('diaryFilters.reset')}</Button>}
          body={t('diaryFilters.noMatchesBody')}
          illustrationLabel={t('emptyStates.searchIllustration')}
          title={t('diaryFilters.noMatches')}
          variant="search"
        />
      ) : (
        <div className="grid gap-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-base font-semibold text-kino-muted">{section.title}</h2>
              <div className="grid gap-2">
                {section.data.map((entry) => (
                  <DiaryRow
                    entry={entry}
                    key={entry.id}
                    localizedTitles={localizedTitleMap}
                    onDelete={diaryActions.deleteEntry}
                    onEdit={setSelectedEntry}
                    onUpdate={diaryActions.updateEntry}
                    pendingEntryId={diaryActions.pendingEntryId}
                  />
                ))}
              </div>
            </section>
          ))}
          <AppPagination
            label="Diary pages"
            onPageChange={setPage}
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}

      <DiaryDialog
        entry={selectedEntry}
        localizedTitles={localizedTitleMap}
        onDelete={diaryActions.deleteEntry}
        onClose={() => setSelectedEntry(null)}
        onUpdate={diaryActions.updateEntry}
        pendingEntryId={diaryActions.pendingEntryId}
      />
    </div>
  )
}

function filterAndSortDiaryEntries(
  entries: DiaryEntry[],
  filters: DiaryFilterState,
  diaryCounts: Map<string, number>
) {
  const filtered = entries.filter((entry) => {
    const rating = entry.rating || 0
    if (filters.rating === 'unrated' && rating > 0) return false
    if (
      filters.rating !== 'any' &&
      filters.rating !== 'unrated' &&
      rating !== Number(filters.rating)
    ) {
      return false
    }
    if (filters.watchType !== 'any' && entry.watchType !== filters.watchType) return false
    if (
      filters.year !== 'any' &&
      String(new Date(entry.watchedAt).getFullYear()) !== filters.year
    ) {
      return false
    }
    if (filters.decade !== 'any') {
      const decade = Math.floor(entry.releaseYear / 10) * 10
      if (String(decade) !== filters.decade) return false
    }
    if (
      filters.genre !== 'any' &&
      !entry.genres.some((genre) => String(genre.id) === filters.genre)
    ) {
      return false
    }
    return true
  })

  const direction = filters.sort.endsWith('-asc') ? 1 : -1
  const compareText = (left: string, right: string) => left.localeCompare(right) * direction
  const compareNumber = (left: number, right: number) => (left - right) * direction

  return filtered.sort((left, right) => {
    let result = 0
    if (filters.sort.startsWith('watched-')) {
      result = compareNumber(
        new Date(left.watchedAt).getTime(),
        new Date(right.watchedAt).getTime()
      )
    } else if (filters.sort.startsWith('activity-')) {
      result = compareNumber(
        new Date(left.updatedAt).getTime(),
        new Date(right.updatedAt).getTime()
      )
    } else if (filters.sort.startsWith('count-')) {
      result = compareNumber(
        diaryCounts.get(left.titleId) || 0,
        diaryCounts.get(right.titleId) || 0
      )
    } else if (filters.sort.startsWith('popularity-')) {
      result = compareNumber(left.ratingCount, right.ratingCount)
    } else if (filters.sort.startsWith('title-')) {
      result = compareText(left.titleName, right.titleName)
    } else if (filters.sort.startsWith('release-')) {
      result = compareNumber(left.releaseYear, right.releaseYear)
    } else if (filters.sort.startsWith('average-')) {
      result = compareNumber(left.averageRating, right.averageRating)
    } else if (filters.sort.startsWith('rating-')) {
      result = compareNumber(left.rating || 0, right.rating || 0)
    } else if (filters.sort.startsWith('runtime-')) {
      result = compareNumber(left.runtime || 0, right.runtime || 0)
    }

    if (result !== 0) return result
    const watchedTieBreak = new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime()
    return watchedTieBreak !== 0 ? watchedTieBreak : left.id.localeCompare(right.id)
  })
}

type DiaryEntryUpdate = {
  rating?: number
  watchedAt?: Date
  watchType?: WatchType
}

function useDiaryEntryActions(userId: string | undefined) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { t } = useTranslation()
  const queryKey = ['diary', userId] as const

  function refreshRelatedData(entry: DiaryEntry) {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    queryClient.invalidateQueries({ queryKey: ['title-user-data', entry.titleId, userId] })
    queryClient.invalidateQueries({ queryKey: ['title-stats', entry.titleId] })
  }

  const updateMutation = useMutation({
    mutationFn: async ({ entry, updates }: { entry: DiaryEntry; updates: DiaryEntryUpdate }) => {
      const watchedAt = updates.watchedAt ?? new Date(entry.watchedAt)
      const watchType = updates.watchType ?? entry.watchType

      if (updates.watchedAt || updates.watchType) {
        await db.updateWatchDiaryEntry(entry.id, { watchedAt, watchType })
      }

      if (entry.type === 'movie') {
        const rating = updates.rating ?? entry.rating ?? 0
        if (rating > 0) {
          await db.rateTitle(entry.titleId, rating, watchType, watchedAt)
        } else if (updates.rating !== undefined) {
          await db.deleteTitleRating(entry.titleId)
        }
      }
    },
    onMutate: async ({ entry, updates }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DiaryEntry[]>(queryKey)
      queryClient.setQueryData<DiaryEntry[]>(queryKey, (current = []) =>
        current
          .map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  rating: updates.rating ?? item.rating,
                  watchedAt: updates.watchedAt?.toISOString() ?? item.watchedAt,
                  watchType: updates.watchType ?? item.watchType,
                }
              : item
          )
          .sort(
            (left, right) =>
              new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime()
          )
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      notify({ body: t('common.tryAgain'), title: t('common.failed'), tone: 'error' })
    },
    onSuccess: (_data, { entry }) => refreshRelatedData(entry),
  })

  const deleteMutation = useMutation({
    mutationFn: (entry: DiaryEntry) => db.deleteWatchDiaryEntry(entry.id),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DiaryEntry[]>(queryKey)
      queryClient.setQueryData<DiaryEntry[]>(queryKey, (current = []) =>
        current.filter((item) => item.id !== entry.id)
      )
      return { previous }
    },
    onError: (_error, _entry, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      notify({ body: t('common.tryAgain'), title: t('common.failed'), tone: 'error' })
    },
    onSuccess: (_data, entry) => refreshRelatedData(entry),
  })

  return {
    deleteEntry: deleteMutation.mutateAsync,
    pendingEntryId: updateMutation.isPending
      ? updateMutation.variables?.entry.id
      : deleteMutation.isPending
        ? deleteMutation.variables?.id
        : undefined,
    updateEntry: (entry: DiaryEntry, updates: DiaryEntryUpdate) =>
      updateMutation.mutateAsync({ entry, updates }),
  }
}

function DiaryRow({
  entry,
  localizedTitles,
  onDelete,
  onEdit,
  onUpdate,
  pendingEntryId,
}: {
  entry: DiaryEntry
  localizedTitles: LocalizedTitleMap
  onDelete: (entry: DiaryEntry) => Promise<unknown>
  onEdit: (entry: DiaryEntry) => void
  onUpdate: (entry: DiaryEntry, updates: DiaryEntryUpdate) => Promise<unknown>
  pendingEntryId?: string
}) {
  const { t } = useTranslation()
  const [dateOpen, setDateOpen] = useState(false)
  const watchedDate = entry.watchedAt ? new Date(entry.watchedAt) : new Date()
  const day = String(watchedDate.getDate())
  const fullDate = formatDate(entry.watchedAt)
  const localized = localizedTitles[localizedTitleKey({ tmdbId: entry.tmdbId, type: entry.type })]
  const displayTitle = localized?.title || entry.titleName
  const poster = getTmdb().getImageUrl(localized?.posterPath ?? entry.coverImage, 'w200')
  const releaseYear = localized?.year ?? entry.releaseYear
  const pending = pendingEntryId === entry.id
  const ratingLabel = t('diary.ratingLabel', { title: displayTitle })

  return (
    <Card className="grid grid-cols-[40px_44px_minmax(0,1fr)_auto] items-center gap-3 p-3 lg:grid-cols-[48px_56px_minmax(0,1fr)_160px_auto] lg:gap-4 lg:p-4">
      <div
        aria-label={fullDate}
        className="text-center text-xl font-bold leading-none text-kino-text"
        title={fullDate}
      >
        {day}
      </div>
      <Link href={`/title/${entry.tmdbId}?type=${entry.type}`}>
        <img
          alt={displayTitle}
          className="aspect-[2/3] rounded-md bg-white/[0.06] object-cover"
          src={poster || '/icons/icon-192.png'}
        />
      </Link>
      <div className="min-w-0">
        <Link className="block min-w-0" href={`/title/${entry.tmdbId}?type=${entry.type}`}>
          <h3 className="truncate font-semibold text-kino-text">{displayTitle}</h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-kino-muted">
          <span>{releaseYear || 'TBA'}</span>
          <span>{entry.watchType === 'rewatch' ? t('diary.rewatch') : t('diary.firstTime')}</span>
          <span className="lg:hidden">
            <RatingStars label={ratingLabel} readonly size="sm" value={entry.rating || 0} />
          </span>
        </div>
      </div>

      <div className="hidden items-center justify-end lg:flex">
        <RatingStars
          disabled={pending}
          label={ratingLabel}
          onChange={
            entry.type === 'movie'
              ? (rating) => {
                  void onUpdate(entry, { rating }).catch(() => undefined)
                }
              : undefined
          }
          readonly={entry.type !== 'movie'}
          size="sm"
          value={entry.rating || 0}
        />
      </div>

      <button
        aria-label={t('diary.editEntryLabel', { title: displayTitle })}
        className="grid h-9 w-9 place-items-center rounded-md text-kino-muted hover:bg-white/[0.06] lg:hidden"
        onClick={() => onEdit(entry)}
        type="button"
      >
        <MoreHorizontal size={18} />
      </button>

      <TooltipProvider delayDuration={180}>
        <div className="hidden items-center gap-1 lg:flex">
          <Popover onOpenChange={setDateOpen} open={dateOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    aria-label={t('modals.watchedOn')}
                    disabled={pending}
                    size="icon"
                    variant="ghost"
                  >
                    <CalendarDays aria-hidden="true" size={17} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{t('modals.watchedOn')}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                defaultMonth={watchedDate}
                mode="single"
                onSelect={(date) => {
                  if (!date) return
                  setDateOpen(false)
                  void onUpdate(entry, { watchedAt: date }).catch(() => undefined)
                }}
                selected={watchedDate}
              />
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('diary.rewatch')}
                aria-pressed={entry.watchType === 'rewatch'}
                className={cn(
                  entry.watchType === 'rewatch' ? 'text-kino-accent' : 'text-kino-muted'
                )}
                disabled={pending}
                onClick={() => {
                  void onUpdate(entry, {
                    watchType: entry.watchType === 'rewatch' ? 'first-time' : 'rewatch',
                  }).catch(() => undefined)
                }}
                size="icon"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" size={17} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('diary.rewatch')}</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    aria-label={t('common.delete')}
                    className="text-kino-muted hover:text-red-300"
                    disabled={pending}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete')}</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('modals.deleteEntry')}</AlertDialogTitle>
                <AlertDialogDescription>{t('modals.deleteEntryConfirm')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogButtonCancel>{t('common.cancel')}</AlertDialogButtonCancel>
                <AlertDialogButtonAction
                  disabled={pending}
                  onClick={() => {
                    void onDelete(entry).catch(() => undefined)
                  }}
                  variant="destructive"
                >
                  {t('common.delete')}
                </AlertDialogButtonAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </Card>
  )
}

function DiaryDialog({
  entry,
  localizedTitles,
  onDelete,
  onClose,
  onUpdate,
  pendingEntryId,
}: {
  entry: DiaryEntry | null
  localizedTitles: LocalizedTitleMap
  onDelete: (entry: DiaryEntry) => Promise<unknown>
  onClose: () => void
  onUpdate: (entry: DiaryEntry, updates: DiaryEntryUpdate) => Promise<unknown>
  pendingEntryId?: string
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(entry?.rating || 0)
  const [watchedAt, setWatchedAt] = useState(() => new Date(entry?.watchedAt || Date.now()))
  const [watchType, setWatchType] = useState<WatchType>(entry?.watchType || 'first-time')

  useEffect(() => {
    if (!entry) return
    setRating(entry.rating || 0)
    setWatchedAt(entry.watchedAt ? new Date(entry.watchedAt) : new Date())
    setWatchType(entry.watchType)
  }, [entry])

  if (!entry) return null

  const localized = localizedTitles[localizedTitleKey({ tmdbId: entry.tmdbId, type: entry.type })]
  const displayTitle = localized?.title || entry.titleName
  const pending = pendingEntryId === entry.id

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open={Boolean(entry)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>{t('modals.editEntry')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-2">
            <div className="text-sm font-semibold text-kino-text">{t('title.rateMovie')}</div>
            {entry.type === 'movie' ? (
              <RatingStars
                disabled={pending}
                label={t('diary.ratingLabel', { title: displayTitle })}
                onChange={setRating}
                size="lg"
                value={rating}
              />
            ) : (
              <div className="grid gap-2">
                <RatingStars
                  label={t('diary.ratingLabel', { title: displayTitle })}
                  readonly
                  size="lg"
                  value={rating}
                />
                <p className="text-sm text-kino-muted">{t('seasons.addARate')}</p>
              </div>
            )}
          </section>

          <section className="grid gap-2">
            <div className="text-sm font-semibold text-kino-text">{t('modals.watchedOn')}</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="justify-start" variant="secondary">
                  <CalendarDays size={16} />
                  {formatDate(watchedAt)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  defaultMonth={watchedAt}
                  mode="single"
                  onSelect={(date) => {
                    if (date) setWatchedAt(date)
                  }}
                  selected={watchedAt}
                />
              </PopoverContent>
            </Popover>
          </section>

          <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-kino-text">
            <span className="flex items-center gap-2 font-semibold">
              <RotateCcw size={16} />
              {t('diary.rewatch')}
            </span>
            <input
              checked={watchType === 'rewatch'}
              className="h-5 w-5 accent-kino-accent"
              disabled={pending}
              onChange={(event) => setWatchType(event.target.checked ? 'rewatch' : 'first-time')}
              type="checkbox"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={pending} variant="destructive">
                  <Trash2 size={16} />
                  {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('modals.deleteEntry')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('modals.deleteEntryConfirm')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogButtonCancel>{t('common.cancel')}</AlertDialogButtonCancel>
                  <AlertDialogButtonAction
                    disabled={pending}
                    onClick={() => {
                      void onDelete(entry)
                        .then(onClose)
                        .catch(() => undefined)
                    }}
                    variant="destructive"
                  >
                    {t('common.delete')}
                  </AlertDialogButtonAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex justify-end gap-3">
              <Button disabled={pending} onClick={onClose} variant="secondary">
                {t('common.cancel')}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  void onUpdate(entry, { rating, watchedAt, watchType })
                    .then(onClose)
                    .catch(() => undefined)
                }}
              >
                <Save size={16} />
                {pending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
