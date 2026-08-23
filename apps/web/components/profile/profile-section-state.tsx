'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/localization/i18n'
import type { ProfileSliceState } from '@/lib/profile/profile-progressive-state'
import { resolveProfileSectionPresentation } from '@/lib/profile/profile-section-presentation'

export type ProfileQueryResult<T> = {
  data: T | undefined
  error: Error | null
  fetchStatus: 'fetching' | 'idle' | 'paused'
  status: 'error' | 'pending' | 'success'
  refetch: () => Promise<unknown>
}

export function ProfileSectionState<T>({
  children,
  loadingFallback,
  query,
  state,
}: {
  children: ReactNode
  loadingFallback?: ReactNode
  query: Pick<ProfileQueryResult<T>, 'refetch'>
  state: ProfileSliceState<T>
}) {
  const { t } = useTranslation()

  const presentation = resolveProfileSectionPresentation(state)

  if (presentation.kind === 'pending') {
    if (loadingFallback) {
      return <>{loadingFallback}</>
    }

    return (
      <section aria-busy="true" className="mb-10 min-h-56">
        <Skeleton className="h-6 w-48" />

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="aspect-2/3 w-full" key={`profile-section-skeleton-${index}`} />
          ))}
        </div>
      </section>
    )
  }

  if (presentation.kind === 'paused') {
    return (
      <section className="mb-10 min-h-32 rounded-md border border-white/10 p-4" role="status">
        <p className="text-sm text-kino-muted">{t('common.tryAgain')}</p>

        <Button className="mt-3" onClick={() => void query.refetch()} size="sm" variant="outline">
          {t('search.retry')}
        </Button>
      </section>
    )
  }

  if (presentation.kind === 'error') {
    return (
      <section className="mb-10 min-h-32" role="alert">
        <p className="text-sm text-red-300">{t('search.sectionFailed')}</p>

        <Button className="mt-3" onClick={() => void query.refetch()} size="sm" variant="outline">
          {t('search.retry')}
        </Button>
      </section>
    )
  }

  return (
    <div aria-busy={presentation.busy} className="min-h-0">
      {presentation.refreshFailed ? (
        <p className="mb-3 text-sm text-red-300" role="status">
          {t('search.sectionFailed')}{' '}
          <button className="underline" onClick={() => void query.refetch()} type="button">
            {t('search.retry')}
          </button>
        </p>
      ) : null}

      {children}
    </div>
  )
}

export function ProfileCompactState<T>({
  children,
  query,
  state,
}: {
  children: ReactNode
  query: Pick<ProfileQueryResult<T>, 'refetch'>
  state: ProfileSliceState<T>
}) {
  const { t } = useTranslation()

  const presentation = resolveProfileSectionPresentation(state)

  if (presentation.kind === 'pending') {
    return <Skeleton className="h-10 w-32 rounded-md" />
  }

  if (presentation.kind === 'paused' || presentation.kind === 'error') {
    return (
      <Button onClick={() => void query.refetch()} size="sm" variant="outline">
        {t('search.retry')}
      </Button>
    )
  }

  return (
    <div aria-busy={presentation.busy} className="contents">
      {children}

      {presentation.refreshFailed ? (
        <button
          className="text-xs text-red-300 underline"
          onClick={() => void query.refetch()}
          type="button"
        >
          {t('search.retry')}
        </button>
      ) : null}
    </div>
  )
}

export function ProfileRelationshipAction<T>(props: Parameters<typeof ProfileCompactState<T>>[0]) {
  return <ProfileCompactState {...props} />
}

export function ProfileRatingStatState<T>(props: Parameters<typeof ProfileCompactState<T>>[0]) {
  return <ProfileCompactState {...props} />
}
