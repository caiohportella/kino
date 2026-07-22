'use client'

import type { FollowerInfo, UserProfile } from '@kino/core'
import { applyReleasedSeriesProgress, formatDate, isFutureDateOnly, parseDateOnly } from '@kino/core'
import { EmptyState, Poster } from '@/components/kino'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, Film, LoaderCircle, Search, Star, Tv, UserPlus, UserRoundCheck, UsersRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BannerPickerDialog } from '@/components/banner-picker-dialog'
import { DisplayTitle } from '@/components/display-title'
import { MediaRow } from '@/components/media-row'
import { ProfileSkeleton } from '@/components/skeletons/page-skeletons'
import { ProfileShareDialog } from '@/components/profile-share-dialog'
import { ProtectedEmpty } from '@/components/protected-empty'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast-provider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RatingStars } from '@/components/rating-stars'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { db, getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { titlePath } from '@/lib/routes'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

async function refreshSeriesAvailability(
  items: Awaited<ReturnType<typeof db.getWatchedSeries>>
) {
  const tmdb = getTmdb()

  return Promise.all(
    items.map(async (series) => {
      const metadataSeasons = (series.seasons_metadata || []).filter(
        (season) =>
          season.season_number > 0 &&
          season.episode_count > 0
      )
      if (metadataSeasons.length === 0) return series

      const seasons = metadataSeasons.filter(
        (season) => !isFutureDateOnly(season.air_date)
      )
      if (seasons.length === 0) return applyReleasedSeriesProgress(series, [])

      const results = await Promise.all(
        seasons.map((season) =>
          tmdb.getSeasonDetails(series.tmdb_id, season.season_number).catch(() => null)
        )
      )
      if (results.some((season) => season === null)) return series
      const loadedSeasons = results.filter((season) => season !== null)

      return applyReleasedSeriesProgress(
        series,
        loadedSeasons.flatMap((season) => season.episodes)
      )
    })
  )
}

type SocialListType = 'followers' | 'following'

type UserSearchResult = {
  profile: UserProfile
  isFollowing: boolean
  isSelf: boolean
}

function formatMutualSince(
  timestamp: string,
  locale: string,
  t: ReturnType<typeof useTranslation>['t']
) {
  const date = parseDateOnly(timestamp.slice(0, 10))
  if (!date) return null

  return t('profile.mutualsSince', {
    date: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
  })
}

export function ProfileView({ profileId, username }: { profileId?: string; username?: string }) {
  const user = useAuthStore((state) => state.user)
  const language = useSettingsStore((state) => state.language)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { t } = useTranslation()
  const resolvedProfile = useQuery({
    queryKey: ['profile-by-username', username],
    queryFn: () => db.getUserProfileByUsername(username!),
    enabled: Boolean(username),
  })
  const targetUserId = profileId || resolvedProfile.data?.id || (!username ? user?.id : undefined)
  const isOwnProfile = Boolean(user?.id && targetUserId === user.id)
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false)
  const [profileSearchOpen, setProfileSearchOpen] = useState(false)
  const [profileSearchQuery, setProfileSearchQuery] = useState('')
  const [socialListType, setSocialListType] = useState<SocialListType | null>(null)
  const [movieRatingOpen, setMovieRatingOpen] = useState(false)
  const [seriesRatingOpen, setSeriesRatingOpen] = useState(false)

  const query = useQuery({
    queryKey: ['profile', targetUserId],
    queryFn: async () => {
      const [profile, movies, storedSeries, counts, relationship, publicStats] = await Promise.all([
        db.getUserProfile(targetUserId!),
        db.getWatchedMovies(targetUserId!),
        db.getWatchedSeries(targetUserId!),
        db.getFollowCounts(targetUserId!),
        user && !isOwnProfile
          ? db.getFollowRelationship(targetUserId!)
          : Promise.resolve({
              isFollowing: false,
              isFollowedBy: false,
              isMutual: false,
              mutualSince: undefined as string | undefined,
            }),
        username
          ? db.getPublicProfileStatsByUsername(username).catch(() => null)
          : Promise.resolve(null),
      ])
      const series = await refreshSeriesAvailability(storedSeries)
      return { profile, movies, series, counts, relationship, publicStats }
    },
    enabled: Boolean(targetUserId),
  })

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!targetUserId || !query.data) return
      if (query.data.relationship.isFollowing) await db.unfollowUser(targetUserId)
      else await db.followUser(targetUserId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] }),
  })

  const profileSearch = useQuery({
    queryKey: ['profile-user-search', profileSearchQuery.trim(), user?.id],
    queryFn: async () => {
      const results = await db.searchUsers(profileSearchQuery.trim())
      return Promise.all(
        results.map(async (profile) => {
          const isSelf = Boolean(user?.id && profile.id === user.id)
          const isFollowing = user && !isSelf ? await db.checkFollowStatus(profile.id) : false
          return { profile, isFollowing, isSelf } satisfies UserSearchResult
        })
      )
    },
    enabled: profileSearchOpen && profileSearchQuery.trim().length >= 2,
  })

  const profileSearchFollowMutation = useMutation({
    mutationFn: async (result: UserSearchResult) => {
      if (result.isSelf) return
      if (result.isFollowing) await db.unfollowUser(result.profile.id)
      else await db.followUser(result.profile.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-user-search'] })
      queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] })
    },
  })

  const socialListQuery = useQuery({
    queryKey: ['profile-social-list', targetUserId, socialListType],
    queryFn: () => {
      if (!targetUserId || !socialListType) return []
      return socialListType === 'followers'
        ? db.getFollowers(targetUserId)
        : db.getFollowing(targetUserId)
    },
    enabled: Boolean(targetUserId && socialListType),
  })

  const socialListActionMutation = useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await db.unfollowUser(userId)
        return { followedAt: undefined }
      }
      return { followedAt: await db.followUser(userId) }
    },
    onSuccess: ({ followedAt }, variables) => {
      const key = ['profile-social-list', targetUserId, socialListType]
      queryClient.setQueryData<FollowerInfo[]>(key, (current) => current?.map((entry) => {
        if (entry.id !== variables.userId) return entry
        const isFollowing = !variables.isFollowing
        const isMutual = isFollowing && entry.isFollowedBy
        return { ...entry, isFollowing, isMutual, mutualSince: isMutual ? followedAt : undefined }
      }))
      notify({ tone: 'success', title: t(variables.isFollowing ? 'profile.unfollowedUser' : 'profile.followedUser') })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile-social-list'] })
      queryClient.invalidateQueries({ queryKey: ['profile-user-search'] })
    },
    onMutate: async ({ userId, isFollowing }) => {
      const key = ['profile-social-list', targetUserId, socialListType]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FollowerInfo[]>(key)
      queryClient.setQueryData<FollowerInfo[]>(key, (current) => current?.map((entry) =>
        entry.id === userId
          ? { ...entry, isFollowing: !isFollowing, isMutual: !isFollowing && entry.isFollowedBy, mutualSince: undefined }
          : entry
      ))
      return { previous, key }
    },
    onError: (_error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous)
      notify({
        tone: 'error',
        title: t(variables.isFollowing ? 'common.failed' : 'profile.failedToFollowUser'),
      })
    },
  })

  const stats = useMemo(() => {
    const movieCount =
      query.data?.publicStats?.moviesWatched ??
      new Set(query.data?.movies.map((movie) => movie.id) || []).size
    const seriesCount =
      query.data?.publicStats?.seriesWatched ??
      new Set(query.data?.series.map((series) => series.id) || []).size
    const averageMovieRating =
      movieCount > 0
        ? (query.data?.movies.reduce((sum, movie) => sum + movie.rating, 0) || 0) / movieCount
        : 0
    return { movieCount, seriesCount, averageMovieRating }
  }, [query.data])

  const seriesIds = useMemo(
    () => query.data?.series.map((series) => series.id).sort() || [],
    [query.data?.series]
  )
  const seriesRatingQuery = useQuery({
    queryKey: ['profile-series-ratings', targetUserId, seriesIds.join('|')],
    queryFn: async () => {
      if (!targetUserId || seriesIds.length === 0) return {}
      return db.getAverageSeasonRatingsForTitles(targetUserId, seriesIds)
    },
    enabled: Boolean(targetUserId && seriesIds.length > 0),
  })
  const seriesRatingRows = useMemo(() => {
    const ratings = seriesRatingQuery.data || {}
    return (query.data?.series || [])
      .map((series) => ({
        series,
        rating: ratings[series.id] || 0,
      }))
      .filter((entry) => entry.rating > 0)
      .sort(
        (left, right) =>
          right.rating - left.rating || left.series.title.localeCompare(right.series.title)
      )
  }, [query.data?.series, seriesRatingQuery.data])
  const averageSeriesRating = useMemo(() => {
    if (seriesRatingRows.length === 0) return 0
    return seriesRatingRows.reduce((sum, entry) => sum + entry.rating, 0) / seriesRatingRows.length
  }, [seriesRatingRows])

  if (!targetUserId) {
    return <ProtectedEmpty />
  }

  if (resolvedProfile.isLoading || query.isLoading)
    return <ProfileSkeleton label={t('common.loading')} />

  if (!query.data?.profile) {
    return <EmptyState body={t('common.tryAgain')} title={t('profile.title')} />
  }

  const { profile, movies, series, counts, relationship } = query.data
  const profileName = profile.display_name || profile.username || t('profile.user')
  const initials = getInitials(profile)
  const mutualSinceLabel = !isOwnProfile && relationship.isMutual && relationship.mutualSince
    ? formatMutualSince(relationship.mutualSince, language, t)
    : null

  return (
    <div className="content-frame">
      <section className="relative mb-6 min-h-[540px] overflow-hidden rounded-md border border-white/10 bg-kino-surface md:min-h-[588px]">
        <div className="absolute inset-0 bg-kino-panel">
          {profile.banner_url ? (
            <img alt="" className="h-full w-full object-cover" src={profile.banner_url} />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgb(29_185_84_/_0.18),rgb(255_255_255_/_0.06)_42%,rgb(0_0_0_/_0.16))]" />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-kino-surface via-kino-surface/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

        <div className="relative z-10 grid min-h-[540px] content-end gap-5 p-5 md:min-h-[588px] md:grid-cols-[128px_minmax(0,1fr)_auto] md:items-end md:p-6">
          <Avatar className="h-24 w-24 rounded-md border-4 border-kino-surface bg-kino-panel shadow-[0_18px_42px_rgb(0_0_0_/_0.35)] md:h-32 md:w-32">
            <AvatarImage alt="" src={profile.avatar_url || undefined} className="rounded-md" />
            <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {mutualSinceLabel ? (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-kino-muted">
                <CalendarDays aria-hidden="true" size={14} />
                {mutualSinceLabel}
              </div>
            ) : null}
            <div className="text-sm font-semibold text-kino-muted">
              {profile.username ? `@${profile.username}` : t('profile.title')}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-kino-text md:text-3xl">
              {profileName}
            </h1>
            {profile.bio ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-kino-muted">{profile.bio}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {profile.username ? <ProfileShareDialog username={profile.username} /> : null}
            {!isOwnProfile && user ? (
              <Button disabled={followMutation.isPending} onClick={() => followMutation.mutate()}>
                {relationship.isFollowing ? <UserRoundCheck size={16} /> : <UserPlus size={16} />}
                {relationship.isFollowing ? t('profile.following') : relationship.isFollowedBy ? t('profile.followBack') : t('profile.follow')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <ProfileStatCard icon={Film} label={t('profile.watchedMovies')} value={stats.movieCount} />
        <ProfileStatCard icon={Tv} label={t('profile.watchedSeries')} value={stats.seriesCount} />
        <ProfileStatCard
          icon={Star}
          label={t('profile.avgMovieRating')}
          onClick={() => setMovieRatingOpen(true)}
          value={stats.averageMovieRating.toFixed(1)}
        />
        <ProfileStatCard
          icon={Star}
          label={t('profile.avgSeriesRating')}
          onClick={() => setSeriesRatingOpen(true)}
          value={seriesRatingRows.length > 0 ? averageSeriesRating.toFixed(1) : '—'}
        />
        <SocialStatCard
          icon={UsersRound}
          label={t('profile.followers')}
          onClick={() => setSocialListType('followers')}
          value={counts.followers}
        />
        <SocialStatCard
          icon={UserRoundCheck}
          label={t('profile.following')}
          onClick={() => setSocialListType('following')}
          value={counts.following}
        />
      </div>

      {movies.length === 0 && series.length === 0 ? (
        <EmptyState
          body={t('emptyStates.profileBody')}
          illustrationLabel={t('emptyStates.profileIllustration')}
          title={t('emptyStates.profileTitle')}
          variant="profile"
        />
      ) : (
        <>
          <ProfileShelf items={movies} title={t('profile.watchedMovies')} type="movie" />
          <SeriesShelf items={series} />
        </>
      )}

      {isOwnProfile ? (
        <BannerPickerDialog
          currentBannerUrl={profile.banner_url}
          onOpenChange={setBannerDialogOpen}
          onSelectBanner={async (bannerUrl) => {
            await db.updateUserProfile(user!.id, { banner_url: bannerUrl })
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] }),
              queryClient.invalidateQueries({ queryKey: ['profile-settings', user!.id] }),
            ])
          }}
          open={bannerDialogOpen}
        />
      ) : null}

      <UserSearchDialog
        followMutationPending={profileSearchFollowMutation.isPending}
        onFollowToggle={(result) => profileSearchFollowMutation.mutate(result)}
        onOpenChange={setProfileSearchOpen}
        onQueryChange={setProfileSearchQuery}
        open={profileSearchOpen}
        query={profileSearchQuery}
        results={profileSearch.data || []}
        searchError={profileSearch.error}
        searching={profileSearch.isFetching}
      />

      <SocialListDialog
        actionPending={socialListActionMutation.isPending}
        pendingUserId={socialListActionMutation.variables?.userId}
        listType={socialListType}
        loading={socialListQuery.isFetching}
        onAction={(profile) => socialListActionMutation.mutate({ userId: profile.id, isFollowing: profile.isFollowing })}
        onOpenChange={(open) => {
          if (!open) setSocialListType(null)
        }}
        open={Boolean(socialListType)}
        users={socialListQuery.data || []}
        error={socialListQuery.error}
      />

      <SeriesRatingDialog
        averageRating={averageSeriesRating}
        items={query.data?.series || []}
        open={seriesRatingOpen}
        onOpenChange={setSeriesRatingOpen}
        ratedCount={seriesRatingRows.length}
        ratingRows={seriesRatingRows}
      />
      <MovieRatingDialog
        averageRating={stats.averageMovieRating}
        items={movies}
        onOpenChange={setMovieRatingOpen}
        open={movieRatingOpen}
      />
    </div>
  )
}

function getInitials(profile: Pick<UserProfile, 'display_name' | 'username'>) {
  const value = profile.display_name || profile.username || 'K'
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function SocialStatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string
  value: number
  icon: LucideIcon
  onClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      aria-label={t('profile.openList', { label })}
      className="group flex min-h-28 flex-col justify-center rounded-md border border-white/10 bg-kino-surface p-4 text-left transition-colors hover:border-kino-accent/50 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-kino-text">{value}</div>
        <Icon
          aria-hidden="true"
          className="text-kino-muted transition-colors group-hover:text-kino-text"
          size={18}
        />
      </div>
      <div className="mt-2 text-sm font-semibold text-kino-muted group-hover:text-kino-text">
        {label}
      </div>
    </button>
  )
}

function ProfileStatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  onClick?: () => void
}) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={cn(
        'flex min-h-28 flex-col justify-center rounded-md border border-white/10 bg-white/[0.035] p-4 text-left',
        onClick &&
          'cursor-pointer transition-colors hover:border-kino-accent/50 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent'
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-kino-text">{value}</div>
        <Icon aria-hidden="true" className="text-kino-muted" size={18} />
      </div>
      <div className="mt-2 text-sm font-semibold text-kino-muted">{label}</div>
    </Component>
  )
}

function UserSearchDialog({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  searching,
  searchError,
  onFollowToggle,
  followMutationPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  results: UserSearchResult[]
  searching: boolean
  searchError: Error | null
  onFollowToggle: (result: UserSearchResult) => void
  followMutationPending: boolean
}) {
  const trimmedQuery = query.trim()
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('profile.findPeople')}</DialogTitle>
          <DialogDescription>{t('profile.searchUsers')}</DialogDescription>
        </DialogHeader>

        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-kino-text">{t('profile.title')}</span>
          <div className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-kino-surface px-3 focus-within:border-kino-accent">
            <Search size={17} className="shrink-0 text-kino-muted" />
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-base text-kino-text outline-none placeholder:text-kino-muted/60"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('profile.searchUsers')}
              value={query}
            />
            {searching ? <Skeleton className="size-4 rounded-full" /> : null}
          </div>
        </label>

        <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1">
          {trimmedQuery.length < 2 ? (
            <DialogEmptyState body={t('profile.searchUsers')} title={t('profile.findPeople')} />
          ) : null}

          {searchError ? (
            <DialogEmptyState body={t('common.tryAgain')} title={t('common.failed')} />
          ) : null}

          {trimmedQuery.length >= 2 && !searching && !searchError && results.length === 0 ? (
            <DialogEmptyState body={t('profile.searchUsers')} title={t('profile.noUsersFound')} />
          ) : null}

          {results.map((result) => (
            <ProfileUserRow
              action={
                result.isSelf ? (
                  <span className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-kino-muted">
                    {t('profile.user')}
                  </span>
                ) : (
                  <Button
                    disabled={followMutationPending}
                    onClick={() => onFollowToggle(result)}
                    size="sm"
                    variant={result.isFollowing ? 'secondary' : 'default'}
                  >
                    {result.isFollowing ? <UserRoundCheck size={15} /> : <UserPlus size={15} />}
                    {result.isFollowing ? t('profile.following') : t('profile.follow')}
                  </Button>
                )
              }
              key={result.profile.id}
              profile={result.profile}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SocialListDialog({
  open,
  onOpenChange,
  listType,
  users,
  loading,
  error,
  onAction,
  actionPending,
  pendingUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  listType: SocialListType | null
  users: FollowerInfo[]
  loading: boolean
  error: Error | null
  onAction: (profile: FollowerInfo) => void
  actionPending: boolean
  pendingUserId?: string
}) {
  const { t } = useTranslation()
  const title = listType === 'following' ? t('profile.following') : t('profile.followers')
  const emptyCopy = listType === 'following' ? t('profile.noUsersFound') : t('profile.noUsersFound')

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black italic tracking-normal sm:text-3xl">
            <DisplayTitle title={title} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[58vh] gap-2 overflow-y-auto pr-1">
          {loading ? <DialogLoadingState label={t('common.loading')} /> : null}
          {error ? (
            <DialogEmptyState body={t('common.tryAgain')} title={t('common.failed')} />
          ) : null}
          {!loading && !error && users.length === 0 ? (
            <DialogEmptyState body={emptyCopy} title={t('profile.noUsersFound')} />
          ) : null}

          {!loading && !error
            ? users.map((profile) => {
                const isPending = actionPending && pendingUserId === profile.id
                const actionLabel = profile.isFollowing
                  ? t('profile.unfollow')
                  : profile.isFollowedBy
                    ? t('profile.followBack')
                    : t('profile.follow')
                return (
                  <ProfileUserRow
                    action={
                      !profile.isSelf ? (
                        <Button
                          aria-label={isPending ? t('profile.followingUser') : actionLabel}
                          disabled={actionPending}
                          onClick={() => onAction(profile)}
                          size="sm"
                          variant="secondary"
                        >
                          {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> : null}
                          {isPending ? t('profile.followingUser') : actionLabel}
                        </Button>
                      ) : null
                    }
                    key={profile.id}
                    profile={profile}
                  />
                )
              })
            : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProfileModal({
  actions,
  children,
  contentClassName,
  onOpenChange,
  open,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn('flex max-w-3xl flex-col overflow-hidden', contentClassName)}>
        <DialogHeader className="shrink-0 gap-2">
          <DialogTitle className="text-2xl font-black italic tracking-normal sm:text-3xl">
            <DisplayTitle title={title} />
          </DialogTitle>
        </DialogHeader>
        {children}
        {actions ? <div className="flex shrink-0 justify-end gap-3">{actions}</div> : null}
      </DialogContent>
    </Dialog>
  )
}

function MovieRatingDialog({
  averageRating,
  items,
  onOpenChange,
  open,
}: {
  averageRating: number
  items: Awaited<ReturnType<typeof db.getWatchedMovies>>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const localizedTitles = useLocalizedTitles(
    items.map((item) => ({ tmdbId: item.tmdb_id, type: 'movie' as const }))
  )
  const rows = useMemo(
    () =>
      items
        .map((movie) => {
          const localized =
            localizedTitles.data?.[localizedTitleKey({ tmdbId: movie.tmdb_id, type: 'movie' })]
          return {
            displayTitle: localized?.title || movie.title,
            movie,
            posterPath: localized?.posterPath ?? movie.cover_image,
          }
        })
        .sort(
          (left, right) =>
            right.movie.rating - left.movie.rating ||
            left.displayTitle.localeCompare(right.displayTitle)
        )
        .slice(0, 10),
    [items, localizedTitles.data]
  )

  return (
    <ProfileModal onOpenChange={onOpenChange} open={open} title={t('profile.topRatedMovies')}>
      <RatingModalSummary
        averageRating={averageRating}
        label={t('profile.avgMovieRating')}
        summary={t('profile.movieRatingsModalSummary', { total: items.length })}
      />
      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <DialogEmptyState
            body={t('profile.movieRatingsModalEmptyBody')}
            title={t('profile.movieRatingsModalEmptyTitle')}
          />
        ) : (
          rows.map(({ displayTitle, movie, posterPath }, index) => (
            <RatingModalRow
              imageUrl={getTmdb().getImageUrl(posterPath, 'w200')}
              key={movie.id}
              rank={index + 1}
              rating={movie.rating}
              title={displayTitle}
            />
          ))
        )}
      </div>
    </ProfileModal>
  )
}

function RatingModalSummary({
  averageRating,
  label,
  note,
  summary,
}: {
  averageRating: number
  label: string
  note?: string
  summary: string
}) {
  return (
    <div className="grid shrink-0 gap-4 rounded-md border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[170px_1fr]">
      <div className="grid place-items-center gap-2 rounded-md border border-white/10 bg-kino-surface px-4 py-5 text-center">
        <div className="text-4xl font-semibold text-kino-text">
          {averageRating > 0 ? averageRating.toFixed(1) : '—'}
        </div>
        <RatingStars
          className="justify-center"
          label={label}
          readonly
          size="sm"
          value={averageRating}
        />
      </div>
      <div className="grid content-center gap-2">
        <p className="text-sm leading-6 text-kino-muted">{summary}</p>
        {note ? <p className="text-sm leading-6 text-kino-muted">{note}</p> : null}
      </div>
    </div>
  )
}

function RatingModalRow({
  imageUrl,
  rank,
  rating,
  title,
}: {
  imageUrl: string | null
  rank: number
  rating: number
  title: string
}) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-[32px_48px_minmax(0,1fr)] items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[40px_56px_minmax(0,1fr)_auto]">
      <div className="text-center text-lg font-bold leading-none text-kino-text">
        <span aria-hidden="true">{rank}.</span>
        <span className="sr-only">{t('profile.rank', { rank })}</span>
      </div>
      <Poster className="w-12 sm:w-14" src={imageUrl} title={title} />
      <h3 className="truncate font-semibold text-kino-text">{title}</h3>
      <div className="col-start-3 flex flex-wrap items-center gap-2 sm:col-auto sm:flex-nowrap">
        <RatingStars readonly size="sm" value={rating} />
        <span className="text-sm font-semibold text-kino-text">{rating.toFixed(1)}</span>
      </div>
    </div>
  )
}

function SeriesRatingDialog({
  open,
  onOpenChange,
  items,
  ratingRows,
  averageRating,
  ratedCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: Awaited<ReturnType<typeof db.getWatchedSeries>>
  ratingRows: Array<{
    series: Awaited<ReturnType<typeof db.getWatchedSeries>>[number]
    rating: number
  }>
  averageRating: number
  ratedCount: number
}) {
  const { t } = useTranslation()
  const localizedTitles = useLocalizedTitles(
    items.map((item) => ({ tmdbId: item.tmdb_id, type: 'tv' as const }))
  )

  const rows = useMemo(
    () =>
      ratingRows
        .map(({ series, rating }) => {
          const localized =
            localizedTitles.data?.[localizedTitleKey({ tmdbId: series.tmdb_id, type: 'tv' })]
          const displayTitle = localized?.title || series.title
          const posterPath = localized?.posterPath ?? series.cover_image

          return {
            rating,
            series,
            displayTitle,
            posterPath,
          }
        })
        .sort(
          (left, right) =>
            right.rating - left.rating || left.displayTitle.localeCompare(right.displayTitle)
        )
        .slice(0, 10),
    [localizedTitles.data, ratingRows]
  )

  return (
    <ProfileModal onOpenChange={onOpenChange} open={open} title={t('profile.topRatedSeries')}>
      <RatingModalSummary
        averageRating={averageRating}
        label={t('profile.avgSeriesRating')}
        note={t('profile.seriesRatingsModalNote')}
        summary={t('profile.seriesRatingsModalSummary', {
          rated: ratedCount,
          total: items.length,
        })}
      />

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <DialogEmptyState
            body={t('profile.seriesRatingsModalEmptyBody')}
            title={t('profile.seriesRatingsModalEmptyTitle')}
          />
        ) : (
          rows.map(({ series, rating, displayTitle, posterPath }, index) => (
            <RatingModalRow
              imageUrl={getTmdb().getImageUrl(posterPath, 'w200')}
              key={series.id}
              rank={index + 1}
              rating={rating}
              title={displayTitle}
            />
          ))
        )}
      </div>
    </ProfileModal>
  )
}

function ProfileUserRow({
  profile,
  action,
}: {
  profile: UserProfile
  action?: ReactNode
}) {
  const { t } = useTranslation()
  const displayName = profile.display_name || profile.username || t('profile.user')
  const username = profile.username ? `@${profile.username}` : t('profile.title')

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <Link
        className="focus-ring group flex min-w-0 flex-1 items-center gap-3 rounded-md"
        href={profile.username ? `/${profile.username}` : '/settings'}
      >
        <Avatar className="h-12 w-12 rounded-full">
          <AvatarImage alt="" src={profile.avatar_url || undefined} />
          <AvatarFallback>{getInitials(profile)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-kino-text group-hover:text-kino-accent">
            {displayName}
          </span>
          <span className="block truncate text-xs text-kino-muted">{username}</span>
        </span>
      </Link>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function DialogLoadingState({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className="grid min-h-32 gap-3 rounded-md border border-white/10 bg-white/[0.035] p-5"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-[40px_1fr] items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

function DialogEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <EmptyState body={body} className="min-h-56" size="compact" title={title} variant="profile" />
  )
}

function ProfileShelf({
  title,
  items,
  type,
}: {
  title: string
  type: 'movie' | 'tv'
  items: Array<{
    id: string
    tmdb_id: number
    title: string
    cover_image: string | null
    release_year: number
  }>
}) {
  const { t } = useTranslation()
  const localizedTitles = useLocalizedTitles(items.map((item) => ({ tmdbId: item.tmdb_id, type })))

  if (items.length === 0) return null

  const renderTitleCard = (item: (typeof items)[number]) => {
    const localized = localizedTitles.data?.[localizedTitleKey({ tmdbId: item.tmdb_id, type })]
    const displayTitle = localized?.title || item.title
    const posterPath = localized?.posterPath ?? item.cover_image
    const releaseYear = localized?.year ?? item.release_year

    return (
      <Link
        className="grid min-w-0 content-start gap-3"
        href={titlePath(item.tmdb_id, item.title, type)}
        key={item.id}
      >
        <Poster
          className="w-full rounded-md"
          src={getTmdb().getImageUrl(posterPath, 'w300')}
          title={displayTitle}
        />
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text">
            {displayTitle}
          </h3>
          <p className="mt-1 text-xs text-kino-muted">
            {releaseYear || t('profile.releaseYearUnknown')}
          </p>
        </div>
      </Link>
    )
  }

  return <ProfileTitleRow items={items} renderTitleCard={renderTitleCard} title={title} />
}

function SeriesShelf({ items }: { items: Awaited<ReturnType<typeof db.getWatchedSeries>> }) {
  const { t } = useTranslation()
  const watchedSeries = useMemo(() => items.filter((series) => !series.next_episode), [items])
  const keepWatchingSeries = useMemo(
    () => items.filter((series) => Boolean(series.next_episode)),
    [items]
  )
  const localizedTitleRequests = useMemo(
    () => items.map((item) => ({ tmdbId: item.tmdb_id, type: 'tv' as const })),
    [items]
  )
  const localizedTitles = useLocalizedTitles(localizedTitleRequests)

  return (
    <>
      <SeriesShelfRow
        emptyBody={t('emptyStates.keepWatchingBody')}
        items={keepWatchingSeries}
        localizedTitles={localizedTitles}
        title={t('profile.keepWatching')}
      />
      <SeriesShelfRow
        items={watchedSeries}
        localizedTitles={localizedTitles}
        title={t('profile.watchedSeries')}
      />
    </>
  )
}

function SeriesShelfRow({
  title,
  items,
  localizedTitles,
  emptyBody,
}: {
  title: string
  items: Awaited<ReturnType<typeof db.getWatchedSeries>>
  localizedTitles: ReturnType<typeof useLocalizedTitles>
  emptyBody?: string
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return emptyBody ? (
      <section>
        <h2 className="mb-3 text-xl font-semibold text-kino-text">{title}</h2>
        <EmptyState
          body={emptyBody}
          size="compact"
          title={t('emptyStates.keepWatchingTitle')}
          variant="cinema"
        />
      </section>
    ) : null
  }

  const renderTitleCard = (series: (typeof items)[number]) => {
    const localized =
      localizedTitles.data?.[localizedTitleKey({ tmdbId: series.tmdb_id, type: 'tv' })]
    const displayTitle = localized?.title || series.title
    const posterPath = localized?.posterPath ?? series.cover_image
    const releaseYear = localized?.year ?? series.release_year

    return (
      <Link
        className="grid min-w-0 content-start gap-3"
        href={titlePath(series.tmdb_id, series.title, 'tv')}
        key={series.id}
      >
        <Poster
          className="w-full rounded-md"
          src={getTmdb().getImageUrl(posterPath, 'w300')}
          title={displayTitle}
        />
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text">
            {displayTitle}
          </h3>
          <p className="mt-1 text-xs text-kino-muted">
            {releaseYear || t('profile.releaseYearUnknown')}
          </p>
          <SeriesStatusPill series={series} />
        </div>
      </Link>
    )
  }

  return <ProfileTitleRow items={items} renderTitleCard={renderTitleCard} title={title} />
}

const PROFILE_ROW_LIMIT = 12

function ProfileTitleRow<T>({
  items,
  renderTitleCard,
  title,
}: {
  items: T[]
  renderTitleCard: (item: T) => ReactNode
  title: string
}) {
  const { t } = useTranslation()
  const [showAllOpen, setShowAllOpen] = useState(false)
  const hasMore = items.length > PROFILE_ROW_LIMIT
  const visibleItems = hasMore ? items.slice(0, PROFILE_ROW_LIMIT) : items

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold text-kino-text">{title}</h2>
      <MediaRow>
        {visibleItems.map(renderTitleCard)}
        {hasMore ? (
          <Button
            aria-haspopup="dialog"
            className="aspect-[2/3] w-full self-start whitespace-normal text-center"
            onClick={() => setShowAllOpen(true)}
            variant="secondary"
          >
            {t('profile.showAll')}
          </Button>
        ) : null}
      </MediaRow>

      {hasMore ? (
        <ProfileModal
          contentClassName="max-w-5xl"
          onOpenChange={setShowAllOpen}
          open={showAllOpen}
          title={title}
        >
          <div className="poster-grid min-h-0 flex-1 overflow-y-auto pr-1">
            {items.map(renderTitleCard)}
          </div>
        </ProfileModal>
      ) : null}
    </section>
  )
}

function SeriesStatusPill({
  series,
}: {
  series: Awaited<ReturnType<typeof db.getWatchedSeries>>[number]
}) {
  const { t } = useTranslation()

  if (series.is_series_completed || series.is_caught_up) {
    return (
      <span className="mt-3 inline-flex min-h-7 items-center rounded-full bg-kino-accent px-3 text-xs font-bold text-black">
        {t('profile.completed')}
      </span>
    )
  }

  if (series.next_episode) {
    const isUpcoming = isFutureDateOnly(series.next_episode.air_date)

    return (
      <div className="mt-3 grid gap-2">
        <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-3 text-xs font-semibold text-kino-text">
          {t('profile.next')}{' '}
          {t('profile.episodeCode', {
            episode: series.next_episode.episode,
            season: series.next_episode.season,
          })}
        </span>
        {isUpcoming ? (
          <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-white/10 bg-white/[0.08] px-3 text-xs font-semibold text-kino-text">
            {series.next_episode.air_date
              ? t('profile.newEpisodesOn', { date: formatDate(series.next_episode.air_date) })
              : t('profile.newEpisodesSoon')}
          </span>
        ) : null}
      </div>
    )
  }

  if (series.last_episode) {
    return (
      <span className="mt-3 inline-flex min-h-7 items-center rounded-full border border-white/10 bg-white/[0.08] px-3 text-xs font-semibold text-kino-text">
        {t('profile.last')}{' '}
        {t('profile.episodeCode', {
          episode: series.last_episode.episode,
          season: series.last_episode.season,
        })}
      </span>
    )
  }

  return null
}
