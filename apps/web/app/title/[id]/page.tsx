'use client'

import type {
  EpisodeRating,
  MediaType,
  TMDbCast,
  TMDbEpisode,
  TitleDetails,
  TitleRatingStats,
  WatchType,
  Watchlist,
} from '@kino/core'
import { formatDate as formatKinoDate } from '@kino/core'
import {
  calculateSeasonRatingSummary,
  formatRuntime,
  isCompletedSeriesStatus,
  isFutureDateOnly,
  transformMovieToTitleDetails,
  transformTVToTitleDetails,
} from '@kino/core'
import { EmptyState, Poster, ProgressBar, Stat } from '@/components/kino'
import {
  BookmarkPlus,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Eye,
  Plus,
  Save,
  Star,
  Ticket,
  Trash2,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Confetti from 'react-confetti'
import { enUS, fr, it, nb, ptBR } from 'date-fns/locale'
import { useTranslation } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLinksSection,
  type ExternalLinkProvider,
} from '@/components/external-links-section'
import { SeasonSelector } from '@/components/season-selector'
import { MediaModalSkeleton, TitleSkeleton } from '@/components/skeletons/page-skeletons'
import { RatingStars } from '@/components/rating-stars'
import { WatchlistDialog } from '@/components/watchlist-dialog'
import { ShareButton } from '@/components/share-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SingleDatePicker } from '@/components/single-date-picker'
import {
  SplitButton,
  SplitButtonMain,
  SplitButtonSecondary,
} from '@/components/ui/split-button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { db, getTmdb } from '@/lib/services'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { parseResourceSegment, personPath } from '@/lib/routes'

const ANON_TITLE_ID = '00000000-0000-0000-0000-000000000000'
const EXTERNAL_LOGOS = {
  letterboxd: 'https://a.ltrbxd.com/logos/letterboxd-decal-dots-neg-rgb.svg',
  tmdb: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
  tvTime:
    'https://cdn.brandfetch.io/idRVkKuKdb/w/39/h/39/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B',
  seriesGraph:
    'https://seriesgraph.com/_next/image?url=https:%2F%2Fimages.seriesgraph.com%2Ffictional-posters%2F2e65671e-4c85-40a1-b184-44be9a8153a5-10ba660c-a406-42fc-aee1-74f87f822aca-1779031627029.jpg&w=1080&q=75',
} as const

function parseTmdbDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string) {
  return formatKinoDate(parseTmdbDate(value) || value)
}

function getUpcomingSeason(title: TitleDetails) {
  if (title.type !== 'tv') return null
  if (isCompletedSeriesStatus(title.status)) return null

  return (
    title.seasons
      ?.filter((season) => {
        if (season.season_number <= 0) return false
        return isFutureDateOnly(season.air_date)
      })
      .sort((left, right) => left.air_date.localeCompare(right.air_date))[0] ?? null
  )
}

function isUnairedEpisode(episode: TMDbEpisode) {
  return isFutureDateOnly(episode.air_date)
}

function episodeRatingKey(rating: Pick<EpisodeRating, 'seasonNumber' | 'episodeNumber'>) {
  return `${rating.seasonNumber}:${rating.episodeNumber}`
}

function mergeEpisodeRatings(current: EpisodeRating[], updates: EpisodeRating[]) {
  const merged = new Map(current.map((rating) => [episodeRatingKey(rating), rating]))
  for (const rating of updates) merged.set(episodeRatingKey(rating), rating)
  return Array.from(merged.values())
}

export default function TitlePage() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = (searchParams.get('type') === 'tv' ? 'tv' : 'movie') as MediaType
  const tmdbId = parseResourceSegment(params.id).id
  const user = useAuthStore((state) => state.user)
  const language = useSettingsStore((state) => state.language)
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [diaryCalendarOpen, setDiaryCalendarOpen] = useState(false)
  const [diaryDate, setDiaryDate] = useState(() => new Date())

  const titleQuery = useQuery({
    queryKey: ['title-metadata', tmdbId, type, language],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const details =
        type === 'movie'
          ? transformMovieToTitleDetails(
              tmdb,
              await tmdb.getMovieDetails(tmdbId),
              await tmdb.getMovieCredits(tmdbId)
            )
          : transformTVToTitleDetails(
              tmdb,
              await tmdb.getTVDetails(tmdbId),
              await tmdb.getTVCredits(tmdbId)
            )

      let id = ANON_TITLE_ID
      try {
        id = await db.getOrCreateTitle(details)
      } catch (error) {
        if (
          !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '42501'
          )
        ) {
          throw error
        }
      }

      return {
        ...details,
        id,
        averageRating: 0,
        ratingCount: 0,
      } satisfies TitleDetails
    },
    enabled: Number.isFinite(tmdbId),
  })

  const title = titleQuery.data

  const userDataQuery = useQuery({
    queryKey: ['title-user-data', title?.id, user?.id],
    queryFn: async () => {
      if (!title || title.id === ANON_TITLE_ID || !user) {
        return { userRating: null, lastWatch: null, isWatchlisted: false }
      }

      const [userRating, lastWatch, isWatchlisted] = await Promise.all([
        db.getUserRating(title.id),
        db.getLastWatchEntry(title.id),
        db.isTitleWatchlisted(title.id),
      ])
      return { userRating, lastWatch, isWatchlisted }
    },
    enabled: Boolean(title),
  })

  const statsQuery = useQuery({
    queryKey: ['title-stats', title?.id, type],
    queryFn: () => db.getTitleRatingStats(title!.id, type),
    enabled: Boolean(title?.id && title.id !== ANON_TITLE_ID),
  })

  const nowPlayingQuery = useQuery({
    queryKey: ['tmdb-now-playing', 'BR'],
    queryFn: () => getTmdb().getNowPlayingMovies('BR', 'pt-BR'),
    enabled: type === 'movie' && Number.isFinite(tmdbId),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  const rateMutation = useMutation({
    mutationFn: (rating: number) => db.rateTitle(title!.id, rating, 'first-time', new Date()),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', title?.id, user?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['title-stats', title?.id, type],
      })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  const deleteMovieEntryMutation = useMutation({
    mutationFn: () => db.removeMediaHistory(title!.id, 'movie'),
    onSuccess: () => {
      queryClient.setQueryData<{
        userRating: Awaited<ReturnType<typeof db.getUserRating>>
        lastWatch: Awaited<ReturnType<typeof db.getLastWatchEntry>>
        isWatchlisted: boolean
      }>(['title-user-data', title?.id, user?.id], (current) =>
        current ? { ...current, userRating: null, lastWatch: null } : current
      )
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', title?.id, user?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['title-stats', title?.id, type],
      })
      queryClient.invalidateQueries({ queryKey: ['diary', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  const diaryMutation = useMutation({
    mutationFn: async (watchedAt?: Date) => {
      if (!title) return
      if (userDataQuery.data?.lastWatch && !watchedAt) {
        await db.removeMediaHistory(title.id, title.type)
      } else {
        await db.addWatchDiaryEntry(title.id, watchedAt || new Date(), 'first-time')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', title?.id, user?.id],
      })
      queryClient.invalidateQueries({ queryKey: ['diary', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      setDiaryCalendarOpen(false)
      setDiaryDate(new Date())
    },
  })

  function requestAuthForCurrentTitle() {
    const query = searchParams.toString()
    storeAuthRedirect(`${pathname}${query ? `?${query}` : ''}`)
    router.push('/auth/login')
  }

  if (titleQuery.isLoading) return <TitleSkeleton label={t('common.loading')} />

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
  const ticketsUrl = `https://www.ingresso.com.br/busca/resultado?q=${encodeURIComponent(title.title)}`
  const isNowPlayingInBrazil =
    nowPlayingQuery.data?.some((movie) => movie.id === title.tmdbId) ?? false
  const upcomingSeason = getUpcomingSeason(title)
  const diaryLocale = { en: enUS, fr, it, no: nb, pt: ptBR }[language] || enUS
  const today = new Date()
  const earliestDiaryDate = new Date(Math.max(title.year || 1900, 1900), 0, 1)
  const canUsePersonalActions = Boolean(user && title.id !== ANON_TITLE_ID)
  const titleActions = (
    <>
      <div className="grid w-full grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
        <Button
          aria-label={userData?.isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}
          className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap"
          disabled={Boolean(user) && title.id === ANON_TITLE_ID}
          onClick={() => {
            if (!canUsePersonalActions) {
              requestAuthForCurrentTitle()
              return
            }
            setWatchlistOpen(true)
          }}
        >
          <BookmarkPlus size={17} />
          <span>{userData?.isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}</span>
        </Button>
        {userData?.lastWatch ? (
          <Button
            aria-label={t('title.removeHistory')}
            className="min-h-11 w-full whitespace-normal px-4 leading-tight sm:w-auto sm:min-w-36 sm:whitespace-nowrap"
            disabled={diaryMutation.isPending}
            onClick={() => diaryMutation.mutate(undefined)}
            variant="secondary"
          >
            <CalendarCheck size={17} /><span>{t('title.removeHistory')}</span>
          </Button>
        ) : (
          <SplitButton aria-label={t('title.diary')} className="w-full sm:w-auto sm:min-w-36">
            <SplitButtonMain
              disabled={(Boolean(user) && title.id === ANON_TITLE_ID) || diaryMutation.isPending}
              onClick={() => {
                if (!canUsePersonalActions) return requestAuthForCurrentTitle()
                diaryMutation.mutate(new Date())
              }}
            >
              <CalendarCheck /><span className="truncate">{t('title.diary')}</span>
            </SplitButtonMain>
            <SingleDatePicker
              disabled={diaryMutation.isPending}
              endMonth={today}
              locale={diaryLocale}
              onOpenChange={(nextOpen) => {
                if (nextOpen && !canUsePersonalActions) {
                  requestAuthForCurrentTitle()
                  return
                }
                setDiaryCalendarOpen(nextOpen)
              }}
              onSelect={(date) => {
                if (diaryMutation.isPending) return
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
          text={t('title.checkOut', { title: title.title })}
          title={title.title}
          url={`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
        />
      </div>
      {type === 'movie' && isNowPlayingInBrazil ? (
        <Button
          render={
            <Link href={ticketsUrl} target="_blank">
              <Ticket size={17} />
              {t('title.buyCinemaTickets')}
            </Link>
          }
          variant="secondary"
        ></Button>
      ) : null}
    </>
  )

  return (
    <div className="content-frame">
      <TitleHeader actions={titleActions} title={title} upcomingSeason={upcomingSeason} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid items-start gap-6">
          <Card className="self-start p-5 md:p-6">
            <h2 className="text-xl font-semibold text-kino-text">
              {t('title.synopsis', { defaultValue: 'Synopsis' })}
            </h2>
            <p className="max-w-4xl text-base leading-7 text-kino-text">
              {title.synopsis ||
                t('title.noSynopsis', {
                  defaultValue: 'No synopsis is available.',
                })}
            </p>
          </Card>

          {title.type === 'movie' ? (
            <div className="grid gap-5 md:max-w-xl">
              <Card className="self-start p-5 text-center md:p-6">
                <h2 className="mb-4 text-xl font-semibold text-kino-text">
                  {t('title.rateMovie')}
                </h2>
                {user ? (
                  <>
                    <RatingStars
                      className="self-center"
                      disabled={rateMutation.isPending}
                      onChange={(rating) => rateMutation.mutate(rating)}
                      size="lg"
                      value={userData?.userRating?.rating || 0}
                    />
                    {userData?.userRating?.rating ? (
                      <AlertDialog>
                        <div className="mt-3 flex justify-center">
                          <AlertDialogTrigger
                            render={
                              <Button
                                className="text-kino-muted hover:text-red-300"
                                disabled={deleteMovieEntryMutation.isPending}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 size={16} />
                                {t('modals.deleteEntry')}
                              </Button>
                            }
                          ></AlertDialogTrigger>
                        </div>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('modals.deleteEntry')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('modals.deleteEntryConfirm')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={deleteMovieEntryMutation.isPending}
                              onClick={() => deleteMovieEntryMutation.mutate()}
                              variant="destructive"
                            >
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <p className="mt-3 text-sm text-kino-muted">{t('title.tapToRate')}</p>
                    )}
                  </>
                ) : (
                  <Button onClick={requestAuthForCurrentTitle}>
                    <Star size={16} />
                    {t('auth.signIn')}
                  </Button>
                )}
              </Card>
              <CommunityRatingsPanel stats={statsQuery.data} type={title.type} />
              <ExternalLinksPanel title={title} />
            </div>
          ) : null}

          {title.type === 'tv' && title.totalSeasons ? (
            <Card className="p-5 md:p-6">
              <SeasonTabs
                title={title}
                tmdbId={title.tmdbId}
                userCanRate={Boolean(user && title.id !== ANON_TITLE_ID)}
                userId={user?.id}
                onAuthRequired={requestAuthForCurrentTitle}
              />
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <CreditsPanel title={title} />

          {title.type === 'tv' ? (
            <>
              <CommunityRatingsPanel stats={statsQuery.data} type={title.type} />
              <ExternalLinksPanel title={title} />
            </>
          ) : null}
        </aside>
      </div>

      <WatchlistPicker
        onClose={() => setWatchlistOpen(false)}
        open={watchlistOpen}
        titleId={title.id}
        userId={user?.id}
      />
    </div>
  )
}

function TitleHeader({
  actions,
  title,
  upcomingSeason,
}: {
  actions: ReactNode
  title: TitleDetails
  upcomingSeason: ReturnType<typeof getUpcomingSeason>
}) {
  const { t } = useTranslation()

  return (
    <section className="relative mb-6 min-h-[620px] overflow-hidden rounded-md border border-white/10 bg-kino-surface md:min-h-[588px]">
      <div className="absolute inset-0">
        {title.backdropImage ? (
          <img
            alt=""
            className="h-full w-full object-cover object-center"
            src={title.backdropImage}
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,rgb(29_185_84_/_0.16),rgb(255_255_255_/_0.05)_45%,rgb(0_0_0_/_0.18))]" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-kino-surface via-kino-surface/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

      <div className="relative z-10 grid min-h-[620px] content-end gap-5 p-5 md:min-h-[588px] md:grid-cols-[184px_1fr] md:items-end md:p-6">
        <Poster
          className="w-36 border border-white/10 shadow-[0_18px_42px_rgb(0_0_0_/_0.35)] md:w-full"
          src={title.coverImage}
          title={title.title}
        />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-kino-muted">
            <span>{title.type === 'tv' ? t('common.tv') : t('common.movie')}</span>
            <span>{title.year || 'TBA'}</span>
            {title.runtime ? <span>{formatRuntime(title.runtime)}</span> : null}
            {title.totalSeasons ? <span>{title.totalSeasons} seasons</span> : null}
            {title.type === 'tv' && isCompletedSeriesStatus(title.status) ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-3 text-xs font-semibold text-kino-text">
                {t('profile.completed')}
              </span>
            ) : null}
          </div>
          <h1 className="max-w-4xl text-3xl font-semibold text-kino-text md:text-4xl">
            {title.title}
          </h1>
          {title.genres.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {title.genres.slice(0, 5).map((genre) => (
                <span
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-kino-muted"
                  key={genre.id}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          ) : null}
          {upcomingSeason ? (
            <div className="mt-4 flex w-fit max-w-full items-center gap-2 rounded-md border border-kino-accent/35 bg-kino-accent/10 px-3 py-2 text-sm font-semibold text-kino-text">
              <CalendarDays aria-hidden="true" size={16} />
              <span>
                {t('seasons.newSeasonComing', {
                  number: upcomingSeason.season_number,
                })}
                {upcomingSeason.air_date ? ` · ${formatDate(upcomingSeason.air_date)}` : ''}
              </span>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
        </div>
      </div>
    </section>
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['watchlist-picker', userId, titleId],
      })
      queryClient.invalidateQueries({
        queryKey: ['title-user-data', titleId, userId],
      })
    },
  })

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}
        open={open && !createOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('modals.selectWatchlist')}</DialogTitle>
            <DialogDescription>{t('modals.watchlistSelectorHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-white/10 bg-white/[0.03] p-3">
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
                      : 'border-white/10 bg-white/[0.04] text-kino-muted hover:text-kino-text'
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
            <div className="rounded-md border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-kino-muted">
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
          if (userId) queryClient.invalidateQueries({ queryKey: ['watchlists', userId] })
        }}
        open={createOpen}
      />
    </>
  )
}

function CommunityRatingsPanel({
  stats,
  type,
}: {
  stats: TitleRatingStats | undefined
  type: MediaType
}) {
  const { t } = useTranslation()

  return (
    <Card className="grid gap-3 p-5">
      <h2 className="text-lg font-semibold text-kino-text">{t('title.communityRatings')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Star aria-hidden="true" className="text-kino-accent" size={14} />}
          label={type === 'movie' ? t('title.avgMovieRating') : t('title.avgSeriesRating')}
          value={stats?.averageRating.toFixed(1) || '0.0'}
        />
        <Stat
          icon={<UserRound aria-hidden="true" size={14} />}
          label={t('title.userRatings')}
          value={stats?.totalRatings || 0}
        />
      </div>
    </Card>
  )
}

function ExternalLinksPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()
  return (
    <ExternalLinksSection providers={getTitleExternalLinks(title)} title={t('title.seeAlsoOn')} />
  )
}

function getTitleExternalLinks(title: TitleDetails): ExternalLinkProvider[] {
  const links: ExternalLinkProvider[] = []

  if (title.externalIds?.imdb_id) {
    links.push({
      href: `https://www.imdb.com/title/${title.externalIds.imdb_id}`,
      brandColor: '#f5c518',
      iconUrl: '/external/imdb.png',
      label: 'IMDb',
    })
  }

  links.push({
    href: `https://www.themoviedb.org/${title.type === 'tv' ? 'tv' : 'movie'}/${title.tmdbId}`,
    brandColor: '#01b4e4',
    iconUrl: EXTERNAL_LOGOS.tmdb,
    label: 'TMDB',
  })

  if (title.type === 'movie') {
    links.push({
      href: `https://letterboxd.com/tmdb/${title.tmdbId}`,
      brandColor: '#00e054',
      iconUrl: EXTERNAL_LOGOS.letterboxd,
      label: 'Letterboxd',
    })
  }

  links.push({
    href:
      title.type === 'tv' && title.externalIds?.tvdb_id
        ? `https://www.tvtime.com/en/show/${title.externalIds.tvdb_id}`
        : `https://www.tvtime.com/en/search?q=${encodeURIComponent(title.title)}`,
    brandColor: '#f7b900',
    iconUrl: EXTERNAL_LOGOS.tvTime,
    label: 'TV Time',
  })

  if (title.type === 'tv') {
    links.push({
      href: `https://seriesgraph.com/show/${title.tmdbId}`,
      brandColor: '#411052',
      iconUrl: EXTERNAL_LOGOS.seriesGraph,
      label: 'SeriesGraph',
    })
  }

  return links
}

function CreditsPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()
  const directorLabel = title.type === 'tv' ? 'Creator' : 'Director'
  const cast = title.cast.slice(0, 8)

  if (!title.director && cast.length === 0) return null

  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold text-kino-text">{t('title.credits')}</h2>
      </div>

      {title.director ? (
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase text-kino-subtle">
            {title.type === 'tv' ? directorLabel : t('title.director')}
          </h3>
          <CreditPersonLink
            person={title.director}
            roleLabel={title.director.job || directorLabel}
          />
        </section>
      ) : null}

      {cast.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase text-kino-subtle">{t('title.cast')}</h3>
          <div className="grid gap-2">
            {cast.map((person) => (
              <CreditPersonLink
                key={`${person.id}-${person.character || person.name}`}
                person={person}
                roleLabel={person.character}
              />
            ))}
          </div>
        </section>
      ) : null}
    </Card>
  )
}

function CreditPersonLink({ person, roleLabel }: { person: TMDbCast; roleLabel?: string }) {
  const avatar = getTmdb().getImageUrl(person.profile_path, 'w200')
  const initials = person.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link
      aria-label={`View ${person.name} profile`}
      className="focus-ring group flex min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-2 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
      href={personPath(person.id, person.name)}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.06] text-xs font-bold text-kino-muted">
        {avatar ? (
          <img alt="" className="h-full w-full object-cover" loading="lazy" src={avatar} />
        ) : (
          initials
        )}
      </div>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-kino-text group-hover:text-kino-accent">
          {person.name}
        </span>
        {roleLabel ? (
          <span className="block truncate text-xs text-kino-muted">{roleLabel}</span>
        ) : null}
      </span>
    </Link>
  )
}

function SeasonTabs({
  title,
  tmdbId,
  userCanRate,
  userId,
  onAuthRequired,
}: {
  title: TitleDetails
  tmdbId: number
  userCanRate: boolean
  userId: string | undefined
  onAuthRequired: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [celebrationId, setCelebrationId] = useState(0)
  const seasons = useMemo(() => {
    const fromTmdb = title.seasons?.filter((season) => season.season_number > 0)
    if (fromTmdb && fromTmdb.length > 0) return fromTmdb
    return Array.from({ length: title.totalSeasons || 0 }, (_, index) => ({
      id: index + 1,
      name: `Season ${index + 1}`,
      overview: '',
      season_number: index + 1,
      episode_count: 0,
      poster_path: null,
      air_date: '',
    }))
  }, [title.seasons, title.totalSeasons])
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.season_number || 1)
  const initializedTitle = useRef<string | null>(null)
  const titleRatingsKey = ['title-episode-ratings', title.id, userId] as const
  const titleRatingsQuery = useQuery({
    queryKey: titleRatingsKey,
    queryFn: () => db.getUserTitleEpisodeRatings(title.id),
    enabled: userCanRate,
  })
  const defaultSeason = useMemo(() => {
    const firstSeason = seasons[0]?.season_number || 1
    if (!userCanRate) return firstSeason

    const watchedBySeason = new Map<number, number>()
    for (const rating of titleRatingsQuery.data || []) {
      watchedBySeason.set(rating.seasonNumber, (watchedBySeason.get(rating.seasonNumber) || 0) + 1)
    }

    const totalExpectedEpisodes = seasons.reduce((total, season) => total + season.episode_count, 0)
    const seriesCompleted =
      totalExpectedEpisodes > 0 &&
      seasons.every(
        (season) =>
          season.episode_count > 0 &&
          (watchedBySeason.get(season.season_number) || 0) >= season.episode_count
      )
    if (seriesCompleted) return firstSeason

    return (
      seasons.find(
        (season) =>
          season.episode_count > 0 &&
          (watchedBySeason.get(season.season_number) || 0) < season.episode_count
      )?.season_number || firstSeason
    )
  }, [seasons, titleRatingsQuery.data, userCanRate])

  useEffect(() => {
    if (userCanRate && titleRatingsQuery.isLoading) return

    const titleKey = `${title.id}:${title.tmdbId}:${userId || 'anonymous'}`
    if (initializedTitle.current !== titleKey) {
      initializedTitle.current = titleKey
      setSelectedSeason(defaultSeason)
      return
    }

    if (!seasons.some((season) => season.season_number === selectedSeason)) {
      setSelectedSeason(seasons[0]?.season_number || 1)
    }
  }, [
    defaultSeason,
    seasons,
    selectedSeason,
    title.id,
    title.tmdbId,
    titleRatingsQuery.isLoading,
    userCanRate,
    userId,
  ])

  if (seasons.length === 0) return null

  function handleRatingsChanged(savedRatings: EpisodeRating[], completedSeason: boolean) {
    const currentRatings = titleRatingsQuery.data || []
    const mergedRatings = mergeEpisodeRatings(currentRatings, savedRatings)
    queryClient.setQueryData(titleRatingsKey, mergedRatings)

    const expectedEpisodeCount =
      title.totalEpisodes || seasons.reduce((total, season) => total + season.episode_count, 0)
    const seriesWasCompleted =
      expectedEpisodeCount > 0 && currentRatings.length >= expectedEpisodeCount
    const seriesIsCompleted =
      expectedEpisodeCount > 0 && mergedRatings.length >= expectedEpisodeCount
    const completedSeries = !seriesWasCompleted && seriesIsCompleted

    if (
      (completedSeason || completedSeries) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setCelebrationId((current) => current + 1)
    }

    queryClient.invalidateQueries({ queryKey: titleRatingsKey })
  }

  function handleSeasonCleared(seasonNumber: number) {
    queryClient.setQueryData<EpisodeRating[]>(titleRatingsKey, (current = []) =>
      current.filter((rating) => rating.seasonNumber !== seasonNumber)
    )
    queryClient.invalidateQueries({ queryKey: titleRatingsKey })
  }

  return (
    <div>
      {celebrationId > 0 ? (
        <Confetti
          height={document.documentElement.clientHeight}
          key={celebrationId}
          numberOfPieces={180}
          onConfettiComplete={() => setCelebrationId(0)}
          recycle={false}
          style={{
            inset: 0,
            pointerEvents: 'none',
            position: 'fixed',
            zIndex: 50,
          }}
          width={document.documentElement.clientWidth}
        />
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-kino-text">{t('seasons.title')}</h2>
          <p className="mt-1 text-sm text-kino-muted">{t('seasons.progress')}</p>
        </div>
      </div>
      <SeasonSelector
        label={t('seasons.title')}
        onSeasonChange={setSelectedSeason}
        seasons={seasons}
        value={selectedSeason}
      />
      <SeasonEpisodes
        onEpisodeRemoved={(seasonNumber, episodeNumber) => {
          queryClient.setQueryData<EpisodeRating[]>(titleRatingsKey, (current = []) =>
            current.filter(
              (rating) =>
                rating.seasonNumber !== seasonNumber || rating.episodeNumber !== episodeNumber
            )
          )
          queryClient.invalidateQueries({ queryKey: titleRatingsKey })
        }}
        onRatingsChanged={handleRatingsChanged}
        onSeasonCleared={handleSeasonCleared}
        seasonNumber={selectedSeason}
        title={title}
        tmdbId={tmdbId}
        userCanRate={userCanRate}
        userId={userId}
        onAuthRequired={onAuthRequired}
      />
    </div>
  )
}

function SeasonEpisodes({
  title,
  tmdbId,
  seasonNumber,
  userCanRate,
  userId,
  onAuthRequired,
  onRatingsChanged,
  onSeasonCleared,
  onEpisodeRemoved,
}: {
  title: TitleDetails
  tmdbId: number
  seasonNumber: number
  userCanRate: boolean
  userId: string | undefined
  onAuthRequired: () => void
  onRatingsChanged: (ratings: EpisodeRating[], completedSeason: boolean) => void
  onSeasonCleared: (seasonNumber: number) => void
  onEpisodeRemoved: (seasonNumber: number, episodeNumber: number) => void
}) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const language = useSettingsStore((state) => state.language)
  const [selectedEpisode, setSelectedEpisode] = useState<TMDbEpisode | null>(null)
  const [rateSeasonOpen, setRateSeasonOpen] = useState(false)

  const seasonQuery = useQuery({
    queryKey: ['season', tmdbId, seasonNumber, language],
    queryFn: () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      return tmdb.getSeasonDetails(tmdbId, seasonNumber)
    },
  })
  const ratingsKey = ['season-ratings', title.id, seasonNumber, userId] as const
  const ratingsQuery = useQuery({
    queryKey: ratingsKey,
    queryFn: () => db.getUserSeasonRatings(title.id, seasonNumber),
    enabled: userCanRate,
  })

  const ratings = useMemo(
    () => new Map((ratingsQuery.data || []).map((rating) => [rating.episodeNumber, rating])),
    [ratingsQuery.data]
  )
  const seasonRatingSummary = useMemo(
    () => calculateSeasonRatingSummary(ratingsQuery.data || []),
    [ratingsQuery.data]
  )
  const episodes = seasonQuery.data?.episodes || []
  const watchableEpisodes = episodes.filter((episode) => !isUnairedEpisode(episode))
  const watchedCount = watchableEpisodes.filter((episode) =>
    ratings.has(episode.episode_number)
  ).length
  const fullSeasonWatched =
    watchableEpisodes.length > 0 && watchedCount === watchableEpisodes.length

  function refreshRelatedQueries() {
    queryClient.invalidateQueries({ queryKey: ratingsKey })
    queryClient.invalidateQueries({
      queryKey: ['title-stats', title.id, title.type],
    })
    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
  }

  function syncSavedRatings(savedRatings: EpisodeRating[]) {
    const mergedRatings = mergeEpisodeRatings(ratingsQuery.data || [], savedRatings)
    queryClient.setQueryData(ratingsKey, mergedRatings)

    const mergedEpisodeNumbers = new Set(mergedRatings.map((rating) => rating.episodeNumber))
    const completedSeason =
      !fullSeasonWatched &&
      watchableEpisodes.length > 0 &&
      watchableEpisodes.every((episode) => mergedEpisodeNumbers.has(episode.episode_number))

    onRatingsChanged(savedRatings, completedSeason)
    refreshRelatedQueries()
  }

  const seasonWatchedMutation = useMutation({
    mutationFn: async (mode: 'mark' | 'clear') => {
      if (mode === 'mark') {
        return db.markSeasonEpisodesAsWatched(
          title.id,
          seasonNumber,
          watchableEpisodes,
          'first-time'
        )
      }
      await db.removeSeasonEpisodesWatched(title.id, seasonNumber)
      return []
    },
    onSuccess: (savedRatings, mode) => {
      if (mode === 'mark') {
        syncSavedRatings(savedRatings)
      } else {
        queryClient.setQueryData(ratingsKey, [])
        onSeasonCleared(seasonNumber)
        refreshRelatedQueries()
      }
    },
  })

  if (seasonQuery.isLoading) return <MediaModalSkeleton label={t('common.loading')} />

  return (
    <section className="mt-5 grid gap-4">
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-3">
            <h3 className="text-lg font-semibold text-kino-text">
              {t('seasons.season', { number: seasonNumber })}
            </h3>
            <p className="mt-1 text-sm text-kino-muted">
              {t('seasons.episodesProgress', {
                watched: watchedCount,
                total: watchableEpisodes.length || '?',
              })}
            </p>
            {fullSeasonWatched ? (
              <CompletedSeasonRatingSummary
                averageRating={seasonRatingSummary.averageRating}
                ratedEpisodeCount={seasonRatingSummary.ratedEpisodeCount}
                watchedCount={watchedCount}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {fullSeasonWatched ? (
              userCanRate ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button disabled={seasonWatchedMutation.isPending} variant="secondary">
                        <Trash2 size={16} />
                        {t('seasons.unmarkSeasonWatched')}
                      </Button>
                    }
                  ></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('seasons.unmarkSeasonWatched')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('seasons.confirmUnwatchAll', {
                          number: seasonNumber,
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={seasonWatchedMutation.isPending}
                        onClick={() => seasonWatchedMutation.mutate('clear')}
                        variant="destructive"
                      >
                        {t('common.remove')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={onAuthRequired} variant="secondary">
                  <Trash2 size={16} />
                  {t('seasons.unmarkSeasonWatched')}
                </Button>
              )
            ) : (
              <Button
                disabled={seasonWatchedMutation.isPending || watchableEpisodes.length === 0}
                onClick={() => {
                  if (!userCanRate) {
                    onAuthRequired()
                    return
                  }
                  seasonWatchedMutation.mutate('mark')
                }}
                variant="secondary"
              >
                <CheckCircle2 size={16} />
                {t('modals.markWatched')}
              </Button>
            )}
            {!fullSeasonWatched ? (
              <Button
                disabled={watchableEpisodes.length === 0}
                onClick={() => {
                  if (!userCanRate) {
                    onAuthRequired()
                    return
                  }
                  setRateSeasonOpen(true)
                }}
              >
                <Star size={16} />
                {t('modals.seasonRatingModal.rateSeason')}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar
            value={watchableEpisodes.length ? (watchedCount / watchableEpisodes.length) * 100 : 0}
          />
        </div>
      </div>

      <TooltipProvider delay={180}>
        <div className="grid gap-3">
          {episodes.map((episode) => {
            const existingRating = ratings.get(episode.episode_number)
            const isWatched = Boolean(existingRating)
            const isUnaired = isUnairedEpisode(episode)
            const still = getTmdb().getImageUrl(episode.still_path, 'w300')
            const showStill = Boolean(still) && !isUnaired
            const watchLabel = isWatched
              ? t('seasons.markEpisodeUnwatched')
              : isUnaired && episode.air_date
                ? t('seasons.airsOn', { date: formatDate(episode.air_date) })
                : t('modals.markWatched')

            return (
              <article
                className={cn(
                  'grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3 md:items-center',
                  showStill ? 'md:grid-cols-[92px_1fr_auto]' : 'md:grid-cols-[1fr_auto]'
                )}
                key={episode.id}
              >
                {showStill ? (
                  <div className="aspect-video overflow-hidden rounded-md bg-white/[0.04]">
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      decoding="async"
                      height={52}
                      loading="lazy"
                      src={still || ''}
                      width={92}
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h4 className="font-semibold text-kino-text">
                    {episode.episode_number}.{' '}
                    {episode.name || t('seasons.episode', { number: episode.episode_number })}
                  </h4>
                  {episode.overview ? (
                    <p className="mt-1 line-clamp-2 text-sm text-kino-muted">{episode.overview}</p>
                  ) : null}
                  {episode.air_date ? (
                    <p className="mt-2 text-xs text-kino-subtle">
                      {isUnaired
                        ? t('seasons.airsOn', {
                            date: formatDate(episode.air_date),
                          })
                        : formatDate(episode.air_date)}
                    </p>
                  ) : null}
                  {existingRating ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-kino-muted">
                      <CalendarDays aria-hidden="true" size={14} />
                      <span>
                        {t('seasons.watchedOn')} {formatKinoDate(existingRating.watchedAt)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  {isWatched ? (
                    <button
                      aria-label={`Edit rating for episode ${episode.episode_number}`}
                      className="rounded-md p-1 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent"
                      onClick={() => setSelectedEpisode(episode)}
                      type="button"
                    >
                      <RatingStars readonly size="sm" value={existingRating?.rating || 0} />
                    </button>
                  ) : null}
                  {isWatched ? (
                    <AlertDialog>
                      <Tooltip>
                        <AlertDialogTrigger
                          render={
                            <TooltipTrigger
                              render={
                                <Button
                                  aria-label={watchLabel}
                                  className="border-kino-accent/40 bg-kino-accent/10 text-kino-accent hover:bg-kino-accent/15 hover:text-kino-accent"
                                  size="icon"
                                  title={watchLabel}
                                  variant="secondary"
                                >
                                  <Eye size={17} />
                                </Button>
                              }
                            ></TooltipTrigger>
                          }
                        ></AlertDialogTrigger>
                        <TooltipContent>{watchLabel}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mark episode unwatched?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('seasons.confirmUnwatchEpisode', {
                              episodeName: episode.name || episode.episode_number,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              db.removeEpisodeRating(
                                title.id,
                                seasonNumber,
                                episode.episode_number
                              ).then(() => {
                                queryClient.setQueryData<EpisodeRating[]>(
                                  ratingsKey,
                                  (current = []) =>
                                    current.filter(
                                      (rating) => rating.episodeNumber !== episode.episode_number
                                    )
                                )
                                onEpisodeRemoved(seasonNumber, episode.episode_number)
                                refreshRelatedQueries()
                              })
                            }}
                            variant="destructive"
                          >
                            {t('common.remove')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={watchLabel}
                            className={cn(
                              'text-kino-muted hover:text-kino-text',
                              isUnaired && 'cursor-not-allowed opacity-50'
                            )}
                            disabled={isUnaired}
                            onClick={() => {
                              if (!userCanRate) {
                                onAuthRequired()
                                return
                              }
                              setSelectedEpisode(episode)
                            }}
                            size="icon"
                            title={watchLabel}
                            variant="secondary"
                          >
                            <Eye size={17} />
                          </Button>
                        }
                      ></TooltipTrigger>
                      <TooltipContent>{userCanRate ? watchLabel : t('auth.signIn')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </TooltipProvider>

      <EpisodeActionDialog
        episode={selectedEpisode}
        existingRating={selectedEpisode ? ratings.get(selectedEpisode.episode_number) : undefined}
        key={selectedEpisode?.id || 'episode-dialog'}
        onOpenChange={(open) => {
          if (!open) setSelectedEpisode(null)
        }}
        onSaved={(savedRating) => syncSavedRatings([savedRating])}
        seasonNumber={seasonNumber}
        title={title}
      />
      <RateSeasonDialog
        episodes={watchableEpisodes}
        onOpenChange={setRateSeasonOpen}
        onSaved={syncSavedRatings}
        open={rateSeasonOpen}
        seasonNumber={seasonNumber}
        title={title}
      />
    </section>
  )
}

function CompletedSeasonRatingSummary({
  averageRating,
  ratedEpisodeCount,
  watchedCount,
}: {
  averageRating: number | null
  ratedEpisodeCount: number
  watchedCount: number
}) {
  const { t } = useTranslation()

  return (
    <div className="flex max-w-xl flex-col gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Star aria-hidden="true" className="text-kino-accent" size={16} />
        <span className="text-xs font-semibold uppercase text-kino-muted">
          {t('seasons.seasonScore')}
        </span>
        {averageRating !== null ? (
          <span className="text-sm font-bold text-kino-text">{averageRating.toFixed(1)} / 5</span>
        ) : (
          <span className="text-sm font-semibold text-kino-text">{t('title.noRatingsYet')}</span>
        )}
      </div>
      {averageRating !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <RatingStars label="Season average rating" readonly size="sm" value={averageRating} />
          <span className="text-xs text-kino-muted">
            {t('seasons.episodesProgress', {
              watched: ratedEpisodeCount,
              total: watchedCount,
            })}
          </span>
        </div>
      ) : (
        <p className="text-xs leading-5 text-kino-muted">{t('title.noRatingsYet')}</p>
      )}
    </div>
  )
}

function EpisodeActionDialog({
  episode,
  existingRating,
  title,
  seasonNumber,
  onOpenChange,
  onSaved,
}: {
  episode: TMDbEpisode | null
  existingRating: EpisodeRating | undefined
  title: TitleDetails
  seasonNumber: number
  onOpenChange: (open: boolean) => void
  onSaved: (rating: EpisodeRating) => void
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(existingRating?.rating || 0)
  const [watchType, setWatchType] = useState<WatchType>(existingRating?.watchType || 'first-time')
  const [watchedAt, setWatchedAt] = useState(existingRating?.watchedAt || new Date())

  useEffect(() => {
    setRating(existingRating?.rating || 0)
    setWatchType(existingRating?.watchType || 'first-time')
    setWatchedAt(existingRating?.watchedAt || new Date())
  }, [existingRating])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!episode) return
      return db.rateEpisode(
        title.id,
        seasonNumber,
        episode.episode_number,
        rating > 0 ? rating : null,
        watchType,
        watchedAt
      )
    },
    onSuccess: (savedRating) => {
      if (savedRating) onSaved(savedRating)
      onOpenChange(false)
    },
  })

  if (!episode) return null

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(episode)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            S{seasonNumber}E{episode.episode_number} - {episode.name || 'Episode'}
          </DialogTitle>
          <DialogDescription>{t('modals.episodeActionModal.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <section className="grid gap-2">
            <div className="text-sm font-semibold text-kino-text">{t('title.rateMovie')}</div>
            <RatingStars
              disabled={mutation.isPending}
              onChange={setRating}
              size="lg"
              value={rating}
            />
          </section>

          <section className="grid gap-2">
            <div className="text-sm font-semibold text-kino-text">{t('modals.watchedOn')}</div>
            <Popover>
              <PopoverTrigger
                render={
                  <Button className="justify-start" variant="secondary">
                    <CalendarDays size={16} />
                    {formatKinoDate(watchedAt)}
                  </Button>
                }
              ></PopoverTrigger>
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
            <span className="font-semibold">{t('diary.rewatch')}</span>
            <input
              checked={watchType === 'rewatch'}
              className="h-5 w-5 accent-kino-accent"
              disabled={mutation.isPending}
              onChange={(event) => setWatchType(event.target.checked ? 'rewatch' : 'first-time')}
              type="checkbox"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              variant="secondary"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              <Save size={16} />
              {mutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RateSeasonDialog({
  open,
  onOpenChange,
  title,
  seasonNumber,
  episodes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: TitleDetails
  seasonNumber: number
  episodes: TMDbEpisode[]
  onSaved: (ratings: EpisodeRating[]) => void
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)

  useEffect(() => {
    if (open) setRating(0)
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      db.markSeasonEpisodesAsWatched(
        title.id,
        seasonNumber,
        episodes,
        'first-time',
        new Date(),
        rating
      ),
    onSuccess: (savedRatings) => {
      onSaved(savedRatings)
      onOpenChange(false)
    },
  })

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('modals.seasonRatingModal.title', { seasonNumber })}</DialogTitle>
          <DialogDescription>
            {t('modals.seasonRatingModal.setSeasonScorePrompt')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <RatingStars
            disabled={mutation.isPending}
            onChange={setRating}
            size="lg"
            value={rating}
          />
          <Separator />
          <div className="flex justify-end gap-3">
            <Button
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              variant="secondary"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={mutation.isPending || rating <= 0 || episodes.length === 0}
              onClick={() => mutation.mutate()}
            >
              <Star size={16} />
              {mutation.isPending ? t('common.loading') : t('modals.seasonRatingModal.saveRatings')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
