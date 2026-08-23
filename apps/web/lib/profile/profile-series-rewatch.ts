export type ProfileSeriesRequiredEpisode = {
  seasonNumber: number
  episodeNumber: number
}

export type ProfileSeriesWatchOccurrence = {
  seasonNumber: number
  episodeNumber: number
  watchedAt: string
}

export type ProfileSeriesWatchPass = {
  passNumber: number
  completedAt: string
}

export function deriveCompleteSeriesWatchPasses(
  requiredEpisodes: ProfileSeriesRequiredEpisode[],
  watchEvents: ProfileSeriesWatchOccurrence[]
): ProfileSeriesWatchPass[] {
  const qualifyingEpisodes = requiredEpisodes.filter((episode) => episode.seasonNumber !== 0)

  if (qualifyingEpisodes.length === 0) {
    return []
  }

  const watchesByEpisode = new Map<string, ProfileSeriesWatchOccurrence[]>()

  for (const episode of qualifyingEpisodes) {
    const key = `${episode.seasonNumber}:${episode.episodeNumber}`

    const occurrences = watchEvents
      .filter(
        (event) =>
          event.seasonNumber === episode.seasonNumber &&
          event.episodeNumber === episode.episodeNumber
      )
      .sort(
        (left, right) => new Date(left.watchedAt).getTime() - new Date(right.watchedAt).getTime()
      )

    if (occurrences.length === 0) {
      return []
    }

    watchesByEpisode.set(key, occurrences)
  }

  const completePassCount = Math.min(
    ...Array.from(watchesByEpisode.values()).map((occurrences) => occurrences.length)
  )

  return Array.from({ length: completePassCount }, (_, passIndex) => {
    const completionTime = Math.max(
      ...Array.from(watchesByEpisode.values()).map((occurrences) =>
        new Date(occurrences[passIndex]!.watchedAt).getTime()
      )
    )

    return {
      passNumber: passIndex + 1,
      completedAt: new Date(completionTime).toISOString(),
    }
  })
}
