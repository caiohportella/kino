'use client'

import { EmptyState } from '@kino/ui'
import { Compass, LogIn, RotateCcw, Search, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

type ErrorCode = 401 | 403 | 404 | 500

export function ErrorState({
  errorCode,
  title,
  description,
  illustrationLabel,
  primaryAction,
  secondaryAction,
}: {
  errorCode: ErrorCode
  title: string
  description: string
  illustrationLabel: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}) {
  return (
    <div className="relative isolate grid min-h-[calc(100vh-9rem)] place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 select-none text-center text-[clamp(5rem,18vw,6rem)] font-black italic leading-none tracking-[-0.04em] text-white/[0.035]"
      >
        {errorCode}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(72vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-kino-accent/10" />
      <EmptyState
        action={primaryAction}
        body={description}
        illustrationLabel={illustrationLabel}
        illustrationMark={errorCode}
        secondaryAction={secondaryAction}
        title={title}
        variant="missing"
      />
    </div>
  )
}

export function HttpErrorState({ status, onRetry }: { status: ErrorCode; onRetry?: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const translationKey = `errors.${status}`

  const homeAction = (
    <Button asChild variant="secondary">
      <Link href="/discover">
        <Compass data-icon="inline-start" />
        {t('errors.actions.home')}
      </Link>
    </Button>
  )

  let primaryAction: ReactNode
  let secondaryAction: ReactNode = homeAction

  if (status === 401) {
    primaryAction = (
      <Button asChild>
        <Link href="/auth/login">
          <LogIn data-icon="inline-start" />
          {t('errors.actions.signIn')}
        </Link>
      </Button>
    )
  } else if (status === 403) {
    primaryAction = (
      <Button onClick={() => router.back()}>
        <Undo2 data-icon="inline-start" />
        {t('errors.actions.back')}
      </Button>
    )
  } else if (status === 500 && onRetry) {
    primaryAction = (
      <Button onClick={onRetry}>
        <RotateCcw data-icon="inline-start" />
        {t('errors.actions.retry')}
      </Button>
    )
  } else {
    primaryAction = (
      <Button asChild>
        <Link href="/discover">
          <Compass data-icon="inline-start" />
          {t('errors.actions.home')}
        </Link>
      </Button>
    )
    secondaryAction = (
      <Button asChild variant="secondary">
        <Link href="/search">
          <Search data-icon="inline-start" />
          {t('errors.actions.search')}
        </Link>
      </Button>
    )
  }

  return (
    <ErrorState
      description={t(`${translationKey}.body`)}
      errorCode={status}
      illustrationLabel={t(`${translationKey}.illustration`)}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      title={t(`${translationKey}.title`)}
    />
  )
}
