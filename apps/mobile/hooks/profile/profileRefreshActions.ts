type Refetch = () => Promise<unknown>

export function createProfileRefreshActions(refetch: {
  identity: Refetch
  relationship: Refetch
  watchedMovies: Refetch
  watchedSeries: Refetch
}) {
  return {
    refreshAll: async () => {
      await Promise.all([
        refetch.identity(),
        refetch.relationship(),
        refetch.watchedMovies(),
        refetch.watchedSeries(),
      ])
    },
    retryWatchedMovies: async () => {
      await refetch.watchedMovies()
    },
    retryWatchedSeries: async () => {
      await refetch.watchedSeries()
    },
  }
}
