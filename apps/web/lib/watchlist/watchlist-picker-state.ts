export function setWatchlistSelection(
  current: ReadonlyMap<string, string>,
  watchlistId: string,
  contributorId: string | null
) {
  const next = new Map(current)

  if (contributorId) {
    next.set(watchlistId, contributorId)
  } else {
    next.delete(watchlistId)
  }

  return next
}

export function adjustWatchlistSummaryCount<
  T extends {
    titleCount: number
  },
>(summaries: Record<string, T>, watchlistId: string, delta: number): Record<string, T> {
  const current = summaries[watchlistId]

  if (!current) {
    return summaries
  }

  return {
    ...summaries,
    [watchlistId]: {
      ...current,
      titleCount: Math.max(0, current.titleCount + delta),
    },
  }
}

export function isTitleWatchlistedFromSelection(selected: ReadonlyMap<string, string>) {
  return selected.size > 0
}
