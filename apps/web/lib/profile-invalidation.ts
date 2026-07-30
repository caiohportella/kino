import { type ProfileInvalidationDescriptor, profileQueryKeys } from '@kino/core/cache'

export function profileInvalidationKeys(
  descriptor: ProfileInvalidationDescriptor
): readonly (readonly unknown[])[] {
  switch (descriptor.kind) {
    case 'identity':
      return [profileQueryKeys.identity(descriptor)]
    case 'relationship':
      return [profileQueryKeys.relationship(descriptor)]
    case 'watched-movies':
      return [profileQueryKeys.watchedMoviesRoot(descriptor)]
    case 'watched-series':
      return [profileQueryKeys.watchedSeriesRoot(descriptor)]
    case 'statistics':
      return [profileQueryKeys.statistics(descriptor)]
    case 'watchlists':
      return [profileQueryKeys.watchlistsRoot(descriptor)]
    case 'reviews':
      return [profileQueryKeys.reviewsRoot(descriptor)]
    case 'ratings':
      return [profileQueryKeys.ratingsRoot(descriptor)]
    default:
      return assertNever(descriptor)
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled profile invalidation descriptor: ${JSON.stringify(value)}`)
}
