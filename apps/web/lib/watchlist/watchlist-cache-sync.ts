const CHANNEL_NAME = 'kino-watchlist-updates'
const STORAGE_KEY = 'kino:watchlist-updated'

export function publishWatchlistChange(watchlistId: string) {
  if (typeof window === 'undefined') return
  const message = { watchlistId, changedAt: Date.now() }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(message)
    channel.close()
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Cache invalidation still runs in the current tab when storage is unavailable.
  }
}

export function subscribeToWatchlistChanges(onChange: (watchlistId: string) => void) {
  if (typeof window === 'undefined') return () => undefined
  const channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
  const onMessage = (event: MessageEvent<{ watchlistId?: string }>) => {
    if (event.data?.watchlistId) onChange(event.data.watchlistId)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      const message = JSON.parse(event.newValue) as { watchlistId?: string }
      if (message.watchlistId) onChange(message.watchlistId)
    } catch {
      // Ignore malformed external storage events.
    }
  }
  channel?.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)

  return () => {
    channel?.removeEventListener('message', onMessage)
    channel?.close()
    window.removeEventListener('storage', onStorage)
  }
}
