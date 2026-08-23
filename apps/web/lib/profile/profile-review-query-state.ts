type QueryStatus = 'error' | 'pending' | 'success'

type ProfileReviewCount = {
  readonly totalCount: number
}

type ProfileReviewsQuerySnapshot<TData extends ProfileReviewCount> = {
  readonly data: TData | undefined
  readonly status: QueryStatus
}

export type ProfileReviewsQueryState<TData extends ProfileReviewCount> =
  | { readonly kind: 'pending' }
  | { readonly kind: 'error' }
  | { readonly kind: 'empty' }
  | { readonly data: TData; readonly kind: 'content' }

export function resolveProfileReviewsQueryState<TData extends ProfileReviewCount>(
  query: ProfileReviewsQuerySnapshot<TData>
): ProfileReviewsQueryState<TData> {
  if (query.status === 'success' && query.data?.totalCount === 0) {
    return { kind: 'empty' }
  }
  if (query.data !== undefined) {
    return { data: query.data, kind: 'content' }
  }
  if (query.status === 'error') {
    return { kind: 'error' }
  }
  return { kind: 'pending' }
}
