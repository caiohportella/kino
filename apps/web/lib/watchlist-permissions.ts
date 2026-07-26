import type { WatchlistVisibility } from '@kino/core'

export interface WatchlistViewer {
  isOwner: boolean
  hasInvite: boolean
  canEditInvite: boolean
}

export function canViewWatchlist(visibility: WatchlistVisibility, viewer: WatchlistViewer) {
  if (viewer.isOwner || visibility === 'public') return true
  return visibility === 'shared' && viewer.hasInvite
}

export function canEditWatchlist(viewer: WatchlistViewer) {
  return viewer.isOwner || viewer.canEditInvite
}

export function watchlistRobots(visibility: WatchlistVisibility) {
  return visibility === 'public' ? { index: true, follow: true } : { index: false, follow: false }
}
