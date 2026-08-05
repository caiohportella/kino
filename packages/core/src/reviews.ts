import type { MediaType, UserProfile } from './types'

export const REVIEW_MAX_LENGTH = 2000
export const REVIEW_PREVIEW_LIMIT = 6

export interface PublicUserSummary {
  id: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type KinoReviewAuthor = PublicUserSummary

export function toReviewAuthor(
  profile: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>
): KinoReviewAuthor {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  }
}

export function getReviewAuthorLabel(author: Pick<KinoReviewAuthor, 'displayName' | 'username'>) {
  return author.displayName?.trim() || author.username || null
}

export interface ReviewLikeSummary {
  likeCount: number
  likedByViewer: boolean
}

export interface Review extends ReviewLikeSummary {
  id: string
  userId: string
  titleId: string
  mediaType: MediaType
  content: string
  rating: number | null
  createdAt: string
  updatedAt: string
  author: PublicUserSummary
  isViewerReview: boolean
  tier: 0 | 1 | 2
}

export interface ReviewCursor {
  tier: number
  like_count: number
  created_at: string
  id: string
}

export interface TitleReviewsPage {
  items: Review[]
  nextCursor: ReviewCursor | null
  totalCount: number
}

export interface ProfileReviewTitle {
  id: string
  tmdbId: number
  mediaType: MediaType
  name: string
  slug: string
  year: number | null
  posterUrl: string | null
}

export interface ProfileReview extends Review {
  title: ProfileReviewTitle
}

export interface ProfileReviewCursor {
  created_at: string
  id: string
}

export interface ProfileReviewsPage {
  items: ProfileReview[]
  nextCursor: ProfileReviewCursor | null
  totalCount: number
}

export interface ProfileReviewOptions {
  limit?: number
  cursor?: ProfileReviewCursor | null
}

export interface FollowedRating {
  user: PublicUserSummary
  rating: number
  watchedAt: string
}

export interface FollowedRatingsPage {
  items: FollowedRating[]
  totalCount: number
}

export interface FollowedEpisodeRatingsResponse {
  episodes: Record<string, FollowedRating[]>
  totals: Record<string, number>
}

export interface ReviewRow {
  id: string
  user_id: string
  title_id: string
  media_type: MediaType
  content: string
  rating: number | string | null
  created_at: string
  updated_at: string
  like_count?: number | string | null
  liked_by_viewer?: boolean | null
  author_username?: string | null
  author_display_name?: string | null
  author_avatar_url?: string | null
  is_viewer_review?: boolean | null
  tier?: number | string | null
  total_count?: number | string | null
}

export interface FollowedRatingRow {
  user_id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  rating: number | string
  watched_at: string
  total_count?: number | string | null
}

export interface ProfileReviewRow extends ReviewRow {
  title_tmdb_id: number | string
  title_name: string
  title_year?: number | string | null
  title_poster_url?: string | null
}

export const reviewKeys = {
  all: ['title-reviews'] as const,
  title: (titleId: string) => ['title-reviews', titleId] as const,
  detail: (reviewId: string) => ['review', reviewId] as const,
}

export const ratingKeys = {
  followedTitle: (titleId: string) => ['followed-title-ratings', titleId] as const,
  followedEpisodes: (seriesId: string, seasonNumber: number) =>
    ['followed-episode-ratings', seriesId, seasonNumber] as const,
}

export function isValidHalfStepRating(rating?: number | null) {
  if (rating == null) return true
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2)
}

export function validateReviewContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Review content is required')
  if (trimmed.length > REVIEW_MAX_LENGTH) {
    throw new Error(`Review content cannot exceed ${REVIEW_MAX_LENGTH} characters`)
  }
  return trimmed
}

export function mapReviewRow(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    titleId: row.title_id,
    mediaType: row.media_type,
    content: row.content,
    rating: row.rating == null ? null : Number(row.rating),
    likeCount: toSafeCount(row.like_count),
    likedByViewer: Boolean(row.liked_by_viewer),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.user_id,
      username: row.author_username ?? null,
      displayName: row.author_display_name ?? null,
      avatarUrl: row.author_avatar_url ?? null,
    },
    isViewerReview: Boolean(row.is_viewer_review),
    tier: toTier(row.tier),
  }
}

export function mapTitleReviewsPage(rows: ReviewRow[], limit: number): TitleReviewsPage {
  const safeLimit = Math.max(1, limit)
  const pageRows = rows.slice(0, safeLimit)
  const last = pageRows.at(-1)
  return {
    items: pageRows.map(mapReviewRow),
    nextCursor:
      rows.length > safeLimit && last
        ? {
            tier: toTier(last.tier),
            like_count: toSafeCount(last.like_count),
            created_at: last.created_at,
            id: last.id,
          }
        : null,
    totalCount: toSafeCount(rows[0]?.total_count),
  }
}

export const profileReviewKeys = {
  all: ['profile-reviews'] as const,
  profile: (username: string) => ['profile-reviews', username] as const,
  page: (username: string, cursor: ProfileReviewCursor | null) =>
    ['profile-reviews', username, cursor] as const,
}

export function mapProfileReviewsPage(rows: ProfileReviewRow[], limit: number): ProfileReviewsPage {
  const safeLimit = Math.max(1, limit)
  const pageRows = rows.slice(0, safeLimit)
  const last = pageRows.at(-1)

  return {
    items: pageRows.map((row) => ({
      ...mapReviewRow(row),
      title: {
        id: row.title_id,
        tmdbId: Number(row.title_tmdb_id),
        mediaType: row.media_type,
        name: row.title_name,
        slug: slugifyReviewTitle(row.title_name),
        year: row.title_year == null ? null : Number(row.title_year),
        posterUrl: row.title_poster_url ?? null,
      },
    })),
    nextCursor:
      rows.length > safeLimit && last ? { created_at: last.created_at, id: last.id } : null,
    totalCount: toSafeCount(rows[0]?.total_count),
  }
}

export function mapFollowedRatings(rows: FollowedRatingRow[]): FollowedRatingsPage {
  return {
    items: rows.map((row) => ({
      user: {
        id: row.user_id,
        username: row.username ?? null,
        displayName: row.display_name ?? null,
        avatarUrl: row.avatar_url ?? null,
      },
      rating: Number(row.rating),
      watchedAt: row.watched_at,
    })),
    totalCount: toSafeCount(rows[0]?.total_count),
  }
}

function toSafeCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

function toTier(value: unknown): 0 | 1 | 2 {
  const tier = Number(value)
  return tier === 0 || tier === 1 ? tier : 2
}

function slugifyReviewTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
