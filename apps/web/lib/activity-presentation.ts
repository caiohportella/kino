export type ActivityKind =
  | 'watched'
  | 'watched_and_rated'
  | 'watched_and_reviewed'
  | 'rated'
  | 'rated_and_reviewed'
  | 'reviewed'

export function getActivityKind(
  activityType: 'watch' | 'rating' | 'review',
  rating: number | null
): ActivityKind {
  if (activityType === 'rating') return 'rated'
  if (activityType === 'review') return 'reviewed'
  return rating && rating > 0 ? 'watched_and_rated' : 'watched'
}
