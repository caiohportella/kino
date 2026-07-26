export type WatchlistCoverInput = {
  addedAt: string
  itemId: string
  posterPath: string | null
  titleId: string
}

export function createWatchlistCoverVersion(
  watchlistUpdatedAt: string,
  visibility: string,
  items: WatchlistCoverInput[]
) {
  const input = [
    watchlistUpdatedAt,
    visibility,
    ...items.map((item) =>
      [item.itemId, item.titleId, item.addedAt, item.posterPath || ''].join(':')
    ),
  ].join('|')

  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
