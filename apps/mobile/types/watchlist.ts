// Watchlist-related types

export interface Watchlist {
  id: string
  userId: string // The creator/owner ID
  name: string
  description?: string
  thumbnail?: string
  isShared: boolean
  shareCode?: string // 8-char alphanumeric code for sharing
  createdAt: Date
  updatedAt: Date
}

export interface WatchlistItem {
  id: string
  watchlistId: string
  titleId: string
  addedAt: Date
  addedBy: string
}

export interface WatchlistCollaborator {
  id: string
  watchlistId: string
  userId: string
  canEdit: boolean
  addedAt: Date
}
