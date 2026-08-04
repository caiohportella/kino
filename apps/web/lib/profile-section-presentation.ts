import type { ProfileSliceState } from './profile-progressive-state'

export type ProfileSectionPresentation =
  | { readonly canRetry: false; readonly kind: 'pending' }
  | { readonly canRetry: true; readonly kind: 'paused' }
  | { readonly canRetry: true; readonly kind: 'error' }
  | {
      readonly busy: boolean
      readonly kind: 'content'
      readonly refreshFailed: boolean
    }

export function resolveProfileSectionPresentation<T>(
  state: ProfileSliceState<T>
): ProfileSectionPresentation {
  switch (state.phase) {
    case 'initial-pending':
      return { canRetry: false, kind: 'pending' }
    case 'paused':
      return { canRetry: true, kind: 'paused' }
    case 'failed':
      return { canRetry: true, kind: 'error' }
    case 'retained-refresh':
      return { busy: true, kind: 'content', refreshFailed: false }
    case 'retained-refresh-error':
      return { busy: false, kind: 'content', refreshFailed: true }
    case 'empty':
    case 'ready':
      return { busy: false, kind: 'content', refreshFailed: false }
  }
}
