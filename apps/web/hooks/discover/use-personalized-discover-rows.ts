'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildDirectorPersonalizedCandidates } from '@/lib/discover/personalization/director-candidates'
import { buildGenrePersonalizedCandidates } from '@/lib/discover/personalization/genre-candidates'
import { buildStudioPersonalizedCandidates } from '@/lib/discover/personalization/studio-candidates'
import { buildDiscoverTasteProfile } from '@/lib/discover/personalization/taste-profile'
import { buildTitlePersonalizedCandidates } from '@/lib/discover/personalization/title-candidates'
import { selectPersonalizedRows } from '@/lib/discover/personalized-rows'
import {
  profileDiaryEntriesQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
} from '@/lib/profile/profile-query-options'
import { db, getTmdb } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

const PERSONALIZATION_DIARY_LIMIT = 500

export function usePersonalizedDiscoverRows() {
  const user = useAuthStore((state) => state.user)

  const viewerId = user?.id ?? null

  const profileId = viewerId ?? 'anonymous'

  const visibilityScope = viewerId
    ? ({
        kind: 'authenticated',
        userId: viewerId,
      } as const)
    : ({
        kind: 'public',
      } as const)

  const watchedMoviesQuery = useQuery({
    ...profileWatchedMoviesQueryOptions({
      profileId,
      service: db,
      visibilityScope,
    }),
    enabled: Boolean(viewerId),
  })

  const watchedSeriesQuery = useQuery({
    ...profileWatchedSeriesQueryOptions({
      profileId,
      service: db,
      visibilityScope,
    }),
    enabled: Boolean(viewerId),
  })

  const diaryQuery = useQuery({
    ...profileDiaryEntriesQueryOptions({
      profileId,
      service: db,
      visibilityScope,
      limit: PERSONALIZATION_DIARY_LIMIT,
    }),
    enabled: Boolean(viewerId),
  })

  const isTasteProfilePending =
    Boolean(viewerId) &&
    (watchedMoviesQuery.isPending || watchedSeriesQuery.isPending || diaryQuery.isPending)

  const isTasteProfileError =
    Boolean(viewerId) &&
    (watchedMoviesQuery.isError || watchedSeriesQuery.isError || diaryQuery.isError)

  const tasteProfile = useMemo(() => {
    if (!viewerId || isTasteProfilePending || isTasteProfileError) {
      return null
    }

    return buildDiscoverTasteProfile({
      watchedMovies: watchedMoviesQuery.data ?? [],
      watchedSeries: watchedSeriesQuery.data ?? [],
      diaryEntries: diaryQuery.data ?? [],
    })
  }, [
    diaryQuery.data,
    isTasteProfileError,
    isTasteProfilePending,
    viewerId,
    watchedMoviesQuery.data,
    watchedSeriesQuery.data,
  ])

  const titleCandidatesQuery = useQuery({
    queryKey: [
      'discover',
      'personalized',
      'title-candidates',
      viewerId,
      tasteProfile?.titleSeeds
        .slice(0, 4)
        .map((seed) => seed.identity)
        .join(',') ?? '',
    ],

    queryFn: () =>
      buildTitlePersonalizedCandidates({
        tasteProfile: tasteProfile!,
        client: getTmdb(),
      }),

    enabled: Boolean(viewerId && tasteProfile),

    staleTime: 30 * 60 * 1000,

    gcTime: 24 * 60 * 60 * 1000,
  })

  const directorCandidatesQuery = useQuery({
    queryKey: [
      'discover',
      'personalized',
      'director-candidates',
      viewerId,
      tasteProfile?.directors
        .filter((director) => director.titleCount >= 2)
        .slice(0, 4)
        .map((director) => director.personId)
        .join(',') ?? '',
    ],

    queryFn: () =>
      buildDirectorPersonalizedCandidates({
        tasteProfile: tasteProfile!,
        client: getTmdb(),
      }),

    enabled: Boolean(viewerId && tasteProfile),

    staleTime: 30 * 60 * 1000,

    gcTime: 24 * 60 * 60 * 1000,
  })

  const genreCandidatesQuery = useQuery({
    queryKey: [
      'discover',
      'personalized',
      'genre-candidates',
      viewerId,
      tasteProfile?.genres
        .filter((genre) => genre.titleCount >= 3)
        .slice(0, 4)
        .map((genre) => genre.genreId)
        .join(',') ?? '',
    ],

    queryFn: () =>
      buildGenrePersonalizedCandidates({
        tasteProfile: tasteProfile!,
        client: getTmdb(),
      }),

    enabled: Boolean(viewerId && tasteProfile),

    staleTime: 30 * 60 * 1000,

    gcTime: 24 * 60 * 60 * 1000,
  })

  const studioCandidatesQuery = useQuery({
    queryKey: [
      'discover',
      'personalized',
      'studio-candidates',
      viewerId,
      tasteProfile?.studios
        .filter((studio) => studio.titleCount >= 3)
        .slice(0, 4)
        .map((studio) => studio.companyId)
        .join(',') ?? '',
    ],

    queryFn: () =>
      buildStudioPersonalizedCandidates({
        tasteProfile: tasteProfile!,
        client: getTmdb(),
      }),

    enabled: Boolean(viewerId && tasteProfile),

    staleTime: 30 * 60 * 1000,

    gcTime: 24 * 60 * 60 * 1000,
  })

  const rows = useMemo(
    () =>
      selectPersonalizedRows([
        ...(titleCandidatesQuery.data ?? []),

        ...(directorCandidatesQuery.data ?? []),

        ...(genreCandidatesQuery.data ?? []),

        ...(studioCandidatesQuery.data ?? []),
      ]),
    [
      directorCandidatesQuery.data,
      genreCandidatesQuery.data,
      studioCandidatesQuery.data,
      titleCandidatesQuery.data,
    ]
  )

  const isPending =
    isTasteProfilePending ||
    Boolean(
      tasteProfile &&
        (titleCandidatesQuery.isPending ||
          directorCandidatesQuery.isPending ||
          genreCandidatesQuery.isPending ||
          studioCandidatesQuery.isPending)
    )

  const isError =
    isTasteProfileError ||
    titleCandidatesQuery.isError ||
    directorCandidatesQuery.isError ||
    genreCandidatesQuery.isError ||
    studioCandidatesQuery.isError

  const error =
    watchedMoviesQuery.error ??
    watchedSeriesQuery.error ??
    diaryQuery.error ??
    titleCandidatesQuery.error ??
    directorCandidatesQuery.error ??
    genreCandidatesQuery.error ??
    studioCandidatesQuery.error ??
    null

  return {
    viewerId,
    tasteProfile,
    rows,
    isPending,
    isError,
    error,
  }
}
