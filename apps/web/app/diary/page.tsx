'use client'

import type { WatchType } from '@kino/core'
import { groupDiaryByMonth } from '@kino/core'
import { EmptyState } from '@kino/ui'
import { CalendarDays, MoreHorizontal, RotateCcw, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingPanel } from '@/components/loading-panel'
import { PageHeader } from '@/components/page-header'
import { ProtectedEmpty } from '@/components/protected-empty'
import { RatingStars } from '@/components/rating-stars'
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
import type { LocalizedTitleMap } from '@/lib/use-localized-titles'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { db, getTmdb } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

type DiaryEntry = Awaited<ReturnType<typeof db.getDiaryEntries>>[number]

export default function DiaryPage() {
  const user = useAuthStore((state) => state.user)
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null)

  const query = useQuery({
    queryKey: ['diary', user?.id],
    queryFn: () => db.getDiaryEntries(user!.id),
    enabled: Boolean(user),
  })
  const entries = query.data || []
  const localizedTitles = useLocalizedTitles(entries.map((entry) => ({ tmdbId: entry.tmdbId, type: entry.type })))

  if (!user) {
    return <ProtectedEmpty body={t('diary.loginPrompt')} title={t('diary.loginPrompt')} />
  }

  if (query.isLoading) return <LoadingPanel label={t('common.loading')} />

  const sections = groupDiaryByMonth(entries, language)
  const localizedTitleMap = localizedTitles.data || {}

  return (
    <div className="content-frame">
      <PageHeader
        body={t('diary.watchDiary')}
        eyebrow={t('diary.title')}
        title={t('diary.watchDiary')}
      />

      {sections.length === 0 ? (
        <EmptyState
          action={
            <Link href="/search">
              <Button>{t('search.title')}</Button>
            </Link>
          }
          body={t('diary.emptyState')}
          title={t('diary.title')}
        />
      ) : (
        <div className="grid gap-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-sm font-semibold text-kino-muted">
                {section.title}
              </h2>
              <div className="grid gap-2">
                {section.data.map((entry) => (
                  <DiaryRow
                    entry={entry}
                    key={entry.id}
                    localizedTitles={localizedTitleMap}
                    onEdit={setSelectedEntry}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DiaryDialog
        entry={selectedEntry}
        localizedTitles={localizedTitleMap}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  )
}

function DiaryRow({
  entry,
  localizedTitles,
  onEdit,
}: {
  entry: DiaryEntry
  localizedTitles: LocalizedTitleMap
  onEdit: (entry: DiaryEntry) => void
}) {
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const day = new Intl.DateTimeFormat(language, { day: 'numeric' }).format(new Date(entry.watchedAt))
  const localized = localizedTitles[localizedTitleKey({ tmdbId: entry.tmdbId, type: entry.type })]
  const displayTitle = localized?.title || entry.titleName
  const poster = getTmdb().getImageUrl(localized?.posterPath ?? entry.coverImage, 'w200')
  const releaseYear = localized?.year ?? entry.releaseYear

  return (
    <Card className="grid grid-cols-[48px_44px_1fr_auto] items-center gap-3 p-3">
      <div className="text-center text-2xl font-light text-kino-muted">{day}</div>
      <Link href={`/title/${entry.tmdbId}?type=${entry.type}`}>
        <img
          alt={displayTitle}
          className="aspect-[2/3] rounded-md bg-white/[0.06] object-cover"
          src={poster || '/icons/icon-192.png'}
        />
      </Link>
      <Link className="min-w-0" href={`/title/${entry.tmdbId}?type=${entry.type}`}>
        <h3 className="truncate font-semibold text-kino-text">{displayTitle}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-kino-muted">
          <span>{releaseYear || 'TBA'}</span>
          <span>{entry.watchType === 'rewatch' ? t('diary.rewatch') : t('diary.firstTime')}</span>
          <RatingStars readonly size="sm" value={entry.rating || 0} />
        </div>
      </Link>
      <button
        aria-label={`Edit ${displayTitle}`}
        className="grid h-9 w-9 place-items-center rounded-md text-kino-muted hover:bg-white/[0.06]"
        onClick={() => onEdit(entry)}
        type="button"
      >
        <MoreHorizontal size={18} />
      </button>
    </Card>
  )
}

function DiaryDialog({
  entry,
  localizedTitles,
  onClose,
}: {
  entry: DiaryEntry | null
  localizedTitles: LocalizedTitleMap
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const { t } = useTranslation()
  const [rating, setRating] = useState(entry?.rating || 0)
  const [watchedAt, setWatchedAt] = useState(() => new Date(entry?.watchedAt || Date.now()))
  const [watchType, setWatchType] = useState<WatchType>(entry?.watchType || 'first-time')

  useEffect(() => {
    if (!entry) return
    setRating(entry.rating || 0)
    setWatchedAt(new Date(entry.watchedAt))
    setWatchType(entry.watchType)
  }, [entry])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return
      await db.updateWatchDiaryEntry(entry.id, { watchedAt, watchType })
      if (entry.type === 'movie') {
        if (rating > 0) {
          await db.rateTitle(entry.titleId, rating, watchType, watchedAt)
        } else {
          await db.deleteTitleRating(entry.titleId)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['title-user-data', entry?.titleId, user?.id] })
      queryClient.invalidateQueries({ queryKey: ['title-stats', entry?.titleId] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return
      await db.deleteWatchDiaryEntry(entry.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      onClose()
    },
  })

  if (!entry) return null

  const localized = localizedTitles[localizedTitleKey({ tmdbId: entry.tmdbId, type: entry.type })]
  const displayTitle = localized?.title || entry.titleName

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
                disabled={saveMutation.isPending}
                label={`${displayTitle} rating`}
                onChange={setRating}
                size="lg"
                value={rating}
              />
            ) : (
              <div className="grid gap-2">
                <RatingStars label={`${displayTitle} rating`} readonly size="lg" value={rating} />
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
                  {watchedAt.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
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
              disabled={saveMutation.isPending}
              onChange={(event) => setWatchType(event.target.checked ? 'rewatch' : 'first-time')}
              type="checkbox"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={deleteMutation.isPending || saveMutation.isPending} variant="destructive">
                  <Trash2 size={16} />
                  {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('modals.deleteEntry')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('modals.deleteEntryConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogButtonCancel>{t('common.cancel')}</AlertDialogButtonCancel>
                  <AlertDialogButtonAction
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    variant="destructive"
                  >
                    {t('common.delete')}
                  </AlertDialogButtonAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex justify-end gap-3">
              <Button disabled={saveMutation.isPending} onClick={onClose} variant="secondary">
                {t('common.cancel')}
              </Button>
              <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                <Save size={16} />
                {saveMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
