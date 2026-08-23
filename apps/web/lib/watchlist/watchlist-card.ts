import { type WatchlistPreviewTitle } from '@kino/core'

export function getWatchlistParticipantPreview<T>(participants: T[]) {
  if (participants.length <= 1) {
    return {
      mode: 'none' as const,
      visibleParticipants: [],
      remainingCount: 0,
    }
  }

  if (participants.length === 2) {
    return {
      mode: 'pair' as const,
      visibleParticipants: participants,
      remainingCount: 0,
    }
  }

  return {
    mode: 'group' as const,
    visibleParticipants: participants.slice(0, 2),
    remainingCount: participants.length - 2,
  }
}

export function resolveWatchlistLastItemAddedAt(items: { added_at: string }[]) {
  if (items.length === 0) {
    return undefined
  }

  return new Date(Math.max(...items.map((item) => new Date(item.added_at).getTime())))
}

export function getWatchlistLastAddedPresentation(addedAt: Date, now: Date) {
  const isSameDay =
    addedAt.getFullYear() === now.getFullYear() &&
    addedAt.getMonth() === now.getMonth() &&
    addedAt.getDate() === now.getDate()

  if (isSameDay) {
    const elapsedHours = Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60))

    if (elapsedHours < 1) {
      return {
        kind: 'lessThanHour' as const,
      }
    }

    return {
      kind: 'hoursAgo' as const,
      hours: elapsedHours,
    }
  }

  const day = String(addedAt.getDate()).padStart(2, '0')
  const month = String(addedAt.getMonth() + 1).padStart(2, '0')

  if (addedAt.getFullYear() === now.getFullYear()) {
    return {
      kind: 'date' as const,
      date: `${day}/${month}`,
    }
  }

  return {
    kind: 'date' as const,
    date: `${day}/${month}/${addedAt.getFullYear()}`,
  }
}

export function applyLocalizedWatchlistPreviewTitle(
  preview: WatchlistPreviewTitle,
  localized:
    | {
        title: string
        posterPath: string | null
      }
    | undefined,
  getPosterUrl: (posterPath: string) => string | null
): WatchlistPreviewTitle {
  if (!localized) {
    return preview
  }

  const localizedCoverImage = localized.posterPath ? getPosterUrl(localized.posterPath) : null

  return {
    ...preview,
    title: localized.title,
    coverImage: localizedCoverImage ?? preview.coverImage,
  }
}

export function applyLocalizedWatchlistPreviewTitles<
  T extends {
    previewTitles: WatchlistPreviewTitle[]
  },
>(
  watchlists: readonly T[],
  localizedTitles: Record<
    string,
    {
      title: string
      posterPath: string | null
    }
  >,
  getPosterUrl: (posterPath: string) => string | null
): T[] {
  return watchlists.map((watchlist) => ({
    ...watchlist,
    previewTitles: watchlist.previewTitles.map((preview) =>
      applyLocalizedWatchlistPreviewTitle(
        preview,
        localizedTitles[`${preview.type}:${preview.tmdbId}`],
        getPosterUrl
      )
    ),
  }))
}
