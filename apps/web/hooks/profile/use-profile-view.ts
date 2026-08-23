'use client'

import type {
  FollowRelationship,
  PublicWatchlistSummary,
  UserProfile,
  WatchedMovie,
} from '@kino/core'
import { parseDateOnly } from '@kino/core'
import { getLocale } from '@kino/core/locale-config'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBridgeProfileReviewsCache } from '@/hooks/profile/use-profile-reviews'
import {
  useProfileIdentity,
  useProfileSections,
  useProfileUsernameResolution,
} from '@/hooks/profile/use-profile-sections'
import { useProfileMediaStats } from '@/hooks/profile/use-profile-stats'
import { useTranslation } from '@/lib/localization/i18n'
import { invalidateProfileMutation } from '@/lib/profile/profile-invalidation'
import {
  isProfileKnownEmpty,
  type ProfileSliceState,
  selectProfilePageState,
  selectProfileSliceState,
} from '@/lib/profile/profile-progressive-state'
import type { ProfileWatchedSeries } from '@/lib/profile/profile-query-options'
import { syncCurrentUserSearchProfile } from '@/lib/search/upstash/user-sync-client'
import { db } from '@/lib/services'
import { subscribeToWatchlistChanges } from '@/lib/watchlist/watchlist-cache-sync'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

export type ProfileViewProps = {
  profileId?: string
  username?: string
}

export type ProfileViewStatus = 'loading' | 'protected' | 'error' | 'ready'

export type ProfileViewVisibilityScope =
  | {
      kind: 'public'
    }
  | {
      kind: 'authenticated'
      userId: string
    }

type ProfileQueryLike<T> = {
  data: T | undefined
  error: Error | null
  fetchStatus: 'fetching' | 'idle' | 'paused'
  status: 'error' | 'pending' | 'success'
}

const EMPTY_MOVIES: WatchedMovie[] = []

const EMPTY_SERIES: ProfileWatchedSeries[] = []

const EMPTY_WATCHLISTS: PublicWatchlistSummary[] = []

const EMPTY_RELATIONSHIP: FollowRelationship = {
  isFollowedBy: false,
  isFollowing: false,
  isMutual: false,
}

const EMPTY_COUNTS = {
  followers: 0,
  following: 0,
}

export function useProfileView({ profileId, username }: ProfileViewProps) {
  const viewerId = useAuthStore((state) => state.user?.id)

  const language = useSettingsStore((state) => state.language)

  const locale = getLocale(language)

  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const resolvedProfile = useProfileUsernameResolution(db, username)

  const targetUserId = profileId || resolvedProfile.data?.id || (!username ? viewerId : undefined)

  const isOwnProfile = Boolean(viewerId && targetUserId === viewerId)

  const visibilityScope = useMemo<ProfileViewVisibilityScope>(
    () =>
      viewerId
        ? {
            kind: 'authenticated',
            userId: viewerId,
          }
        : {
            kind: 'public',
          },
    [viewerId]
  )

  const identityQuery = useProfileIdentity(
    targetUserId
      ? {
          profileId: targetUserId,
          service: db,
          visibilityScope,
        }
      : undefined
  )

  const canonicalUsername = identityQuery.data?.username || username

  const sections = useProfileSections(
    targetUserId
      ? {
          profileId: targetUserId,
          service: db,
          viewerId,
          visibilityScope,
        }
      : undefined
  )

  const mediaStatsQuery = useProfileMediaStats(
    targetUserId
      ? {
          profileId: targetUserId,
          service: db,
          visibilityScope,
        }
      : undefined
  )

  const [bannerDialogOpen, setBannerDialogOpen] = useState(false)

  useEffect(
    () =>
      subscribeToWatchlistChanges(() => {
        if (targetUserId) {
          void invalidateProfileMutation(queryClient, {
            kind: 'subscription',
            profileId: targetUserId,
            visibilityScope,
          })
        }

        void queryClient.invalidateQueries({
          queryKey: ['public-watchlists'],
        })
      }),
    [queryClient, targetUserId, visibilityScope]
  )

  const stateOwnerId = targetUserId ?? 'pending'

  const relationshipState = toSliceState(sections.relationship, stateOwnerId, () => false)

  const moviesState = toSliceState(sections.watchedMovies, stateOwnerId)

  const seriesState = toSliceState(sections.watchedSeries, stateOwnerId)

  const statisticsState = toSliceState(sections.statistics, stateOwnerId)

  const watchlistsState = toSliceState(sections.watchlists, stateOwnerId)

  const reviewsState = toSliceState(
    sections.reviews,
    stateOwnerId,
    (data) => data.items.length === 0
  )

  const movies = sliceData(moviesState, EMPTY_MOVIES)

  const series = sliceData(seriesState, EMPTY_SERIES)

  const publicWatchlists = sliceData(watchlistsState, EMPTY_WATCHLISTS)

  const movieCount =
    sections.lifetimeStats.data?.moviesWatched ??
    sections.statistics.data?.publicStats?.moviesWatched ??
    0

  const seriesCount =
    mediaStatsQuery.data?.seriesWatched ??
    sections.statistics.data?.publicStats?.seriesWatched ??
    new Set(series.map((watchedSeries) => watchedSeries.id)).size

  const averageMovieRating = mediaStatsQuery.data?.movieRatings.average ?? null

  const averageSeriesRating = mediaStatsQuery.data?.seriesRatings.average ?? null

  const relationship = sections.relationship.data ?? EMPTY_RELATIONSHIP

  const counts = sections.statistics.data?.counts ?? EMPTY_COUNTS

  const identityPageState = targetUserId
    ? selectProfilePageState(
        {
          data: identityQuery.data,
          dataOwnerId: identityQuery.data?.id,
          error: identityQuery.error,
          fetchStatus: identityQuery.fetchStatus,
          status: identityQuery.status,
        },
        targetUserId
      )
    : null

  const profile: UserProfile | null =
    identityPageState?.phase === 'ready' ? identityPageState.identity : null

  const status: ProfileViewStatus = !targetUserId
    ? username && resolvedProfile.isPending
      ? 'loading'
      : 'protected'
    : identityPageState?.phase === 'blocking'
      ? 'loading'
      : identityPageState?.phase === 'error' || !profile
        ? 'error'
        : 'ready'

  const mutualSinceLabel =
    profile && !isOwnProfile && relationship.isMutual && relationship.mutualSince
      ? formatMutualSince(relationship.mutualSince, locale, t)
      : null

  const saveBanner = useCallback(
    async (bannerUrl: string | null) => {
      if (!targetUserId || !isOwnProfile) {
        return
      }

      await db.updateUserProfile(targetUserId, {
        banner_url: bannerUrl,
      })

      await syncCurrentUserSearchProfile('upsert').catch(() => undefined)

      await Promise.all([
        invalidateProfileMutation(queryClient, {
          kind: 'banner',
          profileId: targetUserId,
          visibilityScope,
        }),

        queryClient.invalidateQueries({
          queryKey: ['profile-settings', targetUserId],
        }),
      ])
    },
    [isOwnProfile, queryClient, targetUserId, visibilityScope]
  )

  const overviewIsKnownEmpty = isProfileKnownEmpty([
    moviesState,
    seriesState,
    watchlistsState,
    reviewsState,
  ])

  return {
    banner: {
      currentBannerUrl: profile?.banner_url,

      onOpenChange: setBannerDialogOpen,

      onSelectBanner: saveBanner,

      open: bannerDialogOpen,
    },

    canonicalUsername,

    isOwnProfile,

    mutualSinceLabel,

    movies,

    overview: {
      isKnownEmpty: overviewIsKnownEmpty,

      movies,

      sections: {
        movies: {
          query: sections.watchedMovies,
          state: moviesState,
        },

        reviews: {
          query: sections.reviews,
          state: reviewsState,
        },

        series: {
          query: sections.watchedSeries,
          state: seriesState,
        },

        watchlists: {
          query: sections.watchlists,
          state: watchlistsState,
        },
      },

      series,

      username: profile?.username ?? canonicalUsername,

      watchlists: publicWatchlists,
    },

    profile,

    relationship,
    relationshipQuery: sections.relationship,
    relationshipState,

    series,

    statisticsQuery: sections.statistics,
    statisticsState,

    stats: {
      averageMovieRating,
      averageSeriesRating,

      followers: counts.followers,

      following: counts.following,

      locale,

      moviesWatched: movieCount,

      seriesWatched: seriesCount,
    },

    status,

    targetUserId,

    viewerId,

    visibilityScope,

    watchlists: publicWatchlists,
  }
}

function toSliceState<T>(
  query: ProfileQueryLike<T>,
  profileId: string,
  isEmpty?: (data: T) => boolean
) {
  return selectProfileSliceState(
    {
      data: query.data,

      dataOwnerId: query.data === undefined ? undefined : profileId,

      error: query.error,
      fetchStatus: query.fetchStatus,
      status: query.status,
    },
    profileId,
    isEmpty
  )
}

function sliceData<T>(state: ProfileSliceState<T>, fallback: T): T {
  return 'data' in state ? state.data : fallback
}

function formatMutualSince(
  timestamp: string,
  locale: string,
  t: ReturnType<typeof useTranslation>['t']
) {
  const date = parseDateOnly(timestamp.slice(0, 10))

  if (!date) {
    return null
  }

  return t('profile.mutualsSince', {
    date: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
  })
}
