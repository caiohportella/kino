'use client'

import type { EpisodeRating, TitleDetails, TMDbEpisode, WatchType } from '@kino/core'
import {
  calculateSeasonRatingSummary,
  formatDate as formatKinoDate,
  isFutureDateOnly,
} from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Eye, Save, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Confetti from 'react-confetti'
import { ProgressBar } from '@/components/kino'
import { RatingStars } from '@/components/media/rating-stars'
import { FollowedEpisodeRatingRows } from '@/components/profile/followed-ratings'
import { SeasonSelector } from '@/components/season-selector'
import { MediaModalSkeleton } from '@/components/skeletons/page-skeletons'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useFollowedEpisodeRatings } from '@/hooks/use-followed-ratings'
import { useTranslation } from '@/lib/i18n'
import { db, getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

function parseTmdbDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string) {
  return formatKinoDate(parseTmdbDate(value) || value)
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

/** Season selector + the currently selected season's episode list. Renders
 * nothing if the title has no season data. */
export function SeasonTabs({
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
        onAuthRequired={onAuthRequired}
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
  const historyKey = ['season-watch-history', title.id, seasonNumber, userId] as const

  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: () => db.getUserSeasonWatchHistory(title.id, seasonNumber),
    enabled: userCanRate,
  })
  const followedRatingsQuery = useFollowedEpisodeRatings(title.id, seasonNumber, Boolean(userId))

  const ratings = useMemo(
    () => new Map((ratingsQuery.data || []).map((rating) => [rating.episodeNumber, rating])),
    [ratingsQuery.data]
  )
  const historyByEpisode = useMemo(() => {
    const grouped = new Map<number, EpisodeRating[]>()

    for (const rating of historyQuery.data || []) {
      const current = grouped.get(rating.episodeNumber) ?? []
      current.push(rating)
      grouped.set(rating.episodeNumber, current)
    }

    return grouped
  }, [historyQuery.data])
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
    queryClient.invalidateQueries({ queryKey: historyKey })

    queryClient.invalidateQueries({
      queryKey: ['title-stats', title.id, title.type],
    })

    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
  }

  function syncSavedRatings(savedRatings: EpisodeRating[]) {
    const mergedRatings = mergeEpisodeRatings(ratingsQuery.data || [], savedRatings)
    queryClient.setQueryData(ratingsKey, mergedRatings)
    queryClient.setQueryData<EpisodeRating[]>(historyKey, (current = []) => {
      const byId = new Map(current.map((rating) => [rating.id, rating]))

      for (const rating of savedRatings) {
        byId.set(rating.id, rating)
      }

      return Array.from(byId.values()).sort(
        (left, right) => left.watchedAt.getTime() - right.watchedAt.getTime()
      )
    })

    const mergedEpisodeNumbers = new Set(mergedRatings.map((rating) => rating.episodeNumber))
    const completedSeason =
      !fullSeasonWatched &&
      watchableEpisodes.length > 0 &&
      watchableEpisodes.every((episode) => mergedEpisodeNumbers.has(episode.episode_number))

    onRatingsChanged(savedRatings, completedSeason)
    refreshRelatedQueries()
  }

  function handleRewatchRemoved(ratingId: string, episodeNumber: number) {
    const currentHistory = queryClient.getQueryData<EpisodeRating[]>(historyKey) ?? []

    const nextHistory = currentHistory.filter((rating) => rating.id !== ratingId)

    queryClient.setQueryData(historyKey, nextHistory)

    const latestRemaining = nextHistory
      .filter((rating) => rating.episodeNumber === episodeNumber)
      .sort((left, right) => right.watchedAt.getTime() - left.watchedAt.getTime())[0]

    queryClient.setQueryData<EpisodeRating[]>(ratingsKey, (current = []) => {
      const withoutEpisode = current.filter((rating) => rating.episodeNumber !== episodeNumber)

      return latestRemaining ? [...withoutEpisode, latestRemaining] : withoutEpisode
    })

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
        queryClient.setQueryData(historyKey, [])

        onSeasonCleared(seasonNumber)
        refreshRelatedQueries()
      }
    },
  })

  if (seasonQuery.isLoading) return <MediaModalSkeleton label={t('common.loading')} />

  return (
    <section className="grid gap-4">
      <div className="pt-5">
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
            ) : watchableEpisodes.length > 0 ? (
              <Button
                disabled={seasonWatchedMutation.isPending}
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
            ) : null}

            {watchableEpisodes.length > 0 ? (
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
            const watchHistory = historyByEpisode.get(episode.episode_number) ?? []

            const originalWatch = watchHistory[0]
            const latestRewatch = [...watchHistory]
              .reverse()
              .find((rating) => rating.watchType === 'rewatch')
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
                  'group grid gap-3 border-t border-white/[0.07] px-1 py-4 transition-colors hover:bg-white/2.5 md:items-center',
                  showStill ? 'md:grid-cols-[92px_1fr_auto]' : 'md:grid-cols-[1fr_auto]'
                )}
                key={episode.id}
              >
                {showStill ? (
                  <div className="aspect-video overflow-hidden rounded-md bg-white/4">
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
                  {originalWatch ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-kino-muted">
                      <CalendarDays aria-hidden="true" size={14} />
                      <span>
                        {t('seasons.watchedOn')} {formatKinoDate(originalWatch.watchedAt)}
                        {latestRewatch ? (
                          <>
                            {' · '}
                            {t('diary.rewatch')} {formatKinoDate(latestRewatch.watchedAt)}
                          </>
                        ) : null}
                      </span>
                    </p>
                  ) : null}
                  <FollowedEpisodeRatingRows
                    items={
                      followedRatingsQuery.data?.episodes[
                        `${seasonNumber}:${episode.episode_number}`
                      ] ?? []
                    }
                    totalCount={
                      followedRatingsQuery.data?.totals[
                        `${seasonNumber}:${episode.episode_number}`
                      ] ?? 0
                    }
                  />
                </div>
                <div className="flex w-full items-center justify-between gap-2 md:w-auto md:min-w-48">
                  {isWatched ? (
                    <button
                      aria-label={`Edit rating for episode ${episode.episode_number}`}
                      className="rounded-md p-1 transition-colors hover:bg-white/6 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-kino-accent"
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

                                queryClient.setQueryData<EpisodeRating[]>(
                                  historyKey,
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
                  ) : isUnaired ? null : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={watchLabel}
                            className="text-kino-muted hover:text-kino-text"
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
        onRewatchRemoved={handleRewatchRemoved}
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
  onRewatchRemoved,
}: {
  episode: TMDbEpisode | null
  existingRating: EpisodeRating | undefined
  title: TitleDetails
  seasonNumber: number
  onOpenChange: (open: boolean) => void
  onSaved: (rating: EpisodeRating) => void
  onRewatchRemoved: (ratingId: string, episodeNumber: number) => void
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
      const creatingRewatch =
        existingRating != null && existingRating.watchType !== 'rewatch' && watchType === 'rewatch'

      const removingRewatch = existingRating?.watchType === 'rewatch' && watchType === 'first-time'

      if (removingRewatch && existingRating) {
        await db.removeEpisodeRatingById(existingRating.id)

        onRewatchRemoved(existingRating.id, episode.episode_number)

        return
      }

      return db.rateEpisode(
        title.id,
        seasonNumber,
        episode.episode_number,
        rating > 0 ? rating : null,
        watchType,
        watchedAt,
        undefined,
        creatingRewatch ? undefined : existingRating?.id,
        episode.runtime
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

          <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/4 px-4 py-3 text-sm text-kino-text">
            <span className="font-semibold">{t('diary.rewatch')}</span>
            <input
              checked={watchType === 'rewatch'}
              className="h-5 w-5 accent-kino-accent"
              disabled={mutation.isPending}
              onChange={(event) => {
                const isRewatch = event.target.checked

                setWatchType(isRewatch ? 'rewatch' : 'first-time')

                if (isRewatch && existingRating?.watchType !== 'rewatch') {
                  setWatchedAt(new Date())
                } else if (!isRewatch && existingRating) {
                  setWatchedAt(existingRating.watchedAt)
                }
              }}
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
