import { type ProfileInvalidationDescriptor, profileQueryKeys } from '@kino/core/cache'

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

type OwnedProfileMutation = {
  readonly profileId: string
  readonly visibilityScope: VisibilityScope
}

export type ProfileMutationInvalidation =
  | ({ readonly kind: 'rating-diary'; readonly mediaType: 'movie' | 'tv' } & OwnedProfileMutation)
  | ({
      readonly kind: 'identity' | 'banner' | 'review' | 'subscription' | 'watchlist'
    } & OwnedProfileMutation)
  | ({
      readonly kind: 'follow'
      readonly viewerId: string
    } & OwnedProfileMutation)

export function profileMutationInvalidationDescriptors(
  mutation: ProfileMutationInvalidation
): readonly ProfileInvalidationDescriptor[] {
  const visibilityScopes =
    mutation.visibilityScope.kind === 'public'
      ? ([mutation.visibilityScope] as const)
      : ([{ kind: 'public' } as const, mutation.visibilityScope] as const)
  const scoped = <Kind extends Exclude<ProfileInvalidationDescriptor['kind'], 'relationship'>>(
    kind: Kind,
    profileId = mutation.profileId
  ) =>
    visibilityScopes.map(
      (visibilityScope) =>
        ({ kind, profileId, visibilityScope }) as Extract<
          ProfileInvalidationDescriptor,
          { kind: Kind }
        >
    )

  switch (mutation.kind) {
    case 'rating-diary':
      return [
        ...scoped(mutation.mediaType === 'movie' ? 'watched-movies' : 'watched-series'),
        ...scoped('statistics'),
        ...scoped('ratings'),
      ]
    case 'identity':
    case 'banner':
      return scoped('identity')
    case 'watchlist':
    case 'subscription':
      return scoped('watchlists')
    case 'review':
      return scoped('reviews')
    case 'follow':
      return [
        {
          kind: 'relationship',
          profileId: mutation.profileId,
          viewerId: mutation.viewerId,
        },
        ...scoped('statistics'),
        ...scoped('statistics', mutation.viewerId),
      ]
    default:
      return assertNever(mutation)
  }
}

export function profileMutationInvalidationKeys(
  mutation: ProfileMutationInvalidation
): readonly (readonly unknown[])[] {
  const descriptorKeys = profileMutationInvalidationDescriptors(mutation).flatMap((descriptor) =>
    profileInvalidationKeys(descriptor).map((queryKey) =>
      descriptor.kind === 'relationship' ? queryKey : queryKey.slice(0, 4)
    )
  )
  const keys =
    mutation.kind === 'identity'
      ? [...descriptorKeys, profileQueryKeys.usernameResolutions()]
      : descriptorKeys
  return Array.from(new Map(keys.map((key) => [JSON.stringify(key), key])).values())
}

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

export function invalidateProfileMutation(
  queryClient: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>
  },
  mutation: ProfileMutationInvalidation
) {
  return Promise.all(
    profileMutationInvalidationKeys(mutation).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled profile invalidation descriptor: ${JSON.stringify(value)}`)
}
