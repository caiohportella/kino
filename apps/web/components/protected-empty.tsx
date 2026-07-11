'use client'

import { Button, EmptyState } from '@kino/ui'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function ProtectedEmpty() {
  const { t } = useTranslation()

  return (
    <EmptyState
      action={
        <Link href="/auth/login">
          <Button>{t('auth.signIn')}</Button>
        </Link>
      }
      body={t('emptyStates.authBody')}
      illustrationLabel={t('emptyStates.authIllustration')}
      secondaryAction={
        <Link href="/auth/register">
          <Button tone="secondary">{t('auth.createAccount')}</Button>
        </Link>
      }
      title={t('emptyStates.authTitle')}
      variant="auth"
    />
  )
}
