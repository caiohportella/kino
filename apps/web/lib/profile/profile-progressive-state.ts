type QueryStatus = 'error' | 'pending' | 'success'
type FetchStatus = 'fetching' | 'idle' | 'paused'

export interface ProfileQuerySnapshot<T> {
  readonly data: T | undefined
  readonly dataOwnerId: string | undefined
  readonly error: Error | null
  readonly fetchStatus: FetchStatus
  readonly status: QueryStatus
}

export type ProfilePageState<T> =
  | { readonly phase: 'blocking' }
  | { readonly error: Error; readonly phase: 'error' }
  | { readonly identity: T; readonly phase: 'ready' }

export type ProfileSliceState<T> =
  | { readonly phase: 'initial-pending' }
  | { readonly phase: 'paused' }
  | { readonly error: Error; readonly phase: 'failed' }
  | { readonly data: T; readonly phase: 'empty' }
  | { readonly data: T; readonly phase: 'ready' }
  | { readonly data: T; readonly empty: boolean; readonly phase: 'retained-refresh' }
  | {
      readonly data: T
      readonly empty: boolean
      readonly error: Error
      readonly phase: 'retained-refresh-error'
    }

export function selectProfilePageState<T>(
  snapshot: ProfileQuerySnapshot<T>,
  ownerId: string
): ProfilePageState<T> {
  if (snapshot.dataOwnerId === ownerId && snapshot.data !== undefined) {
    return { identity: snapshot.data, phase: 'ready' }
  }
  if (snapshot.status === 'error' && snapshot.error) {
    return { error: snapshot.error, phase: 'error' }
  }
  return { phase: 'blocking' }
}

export function selectProfileSliceState<T>(
  snapshot: ProfileQuerySnapshot<T>,
  ownerId: string,
  isEmpty: (data: T) => boolean = defaultIsEmpty
): ProfileSliceState<T> {
  const retainedData =
    snapshot.dataOwnerId === ownerId && snapshot.data !== undefined ? snapshot.data : undefined

  if (retainedData !== undefined) {
    const empty = isEmpty(retainedData)
    if (snapshot.status === 'error' && snapshot.error) {
      return {
        data: retainedData,
        empty,
        error: snapshot.error,
        phase: 'retained-refresh-error',
      }
    }
    if (snapshot.fetchStatus === 'fetching') {
      return { data: retainedData, empty, phase: 'retained-refresh' }
    }
    return empty ? { data: retainedData, phase: 'empty' } : { data: retainedData, phase: 'ready' }
  }

  if (snapshot.status === 'error' && snapshot.error) {
    return { error: snapshot.error, phase: 'failed' }
  }
  if (snapshot.fetchStatus === 'paused') return { phase: 'paused' }
  return { phase: 'initial-pending' }
}

export function isProfileKnownEmpty(slices: readonly ProfileSliceState<unknown>[]): boolean {
  return (
    slices.length > 0 &&
    slices.every(
      (slice) =>
        slice.phase === 'empty' ||
        ((slice.phase === 'retained-refresh' || slice.phase === 'retained-refresh-error') &&
          slice.empty)
    )
  )
}

function defaultIsEmpty<T>(data: T): boolean {
  return data === null || (Array.isArray(data) && data.length === 0)
}
