'use client'

import { EmptyState } from '@/components/kino'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function ProtectedEmpty() {
  const { t } = useTranslation()

  return (
    <EmptyState
      action={
        <Link className={buttonVariants()} href="/auth/login">{t('auth.signIn')}</Link>
      }
      body={t('emptyStates.authBody')}
      illustrationLabel={t('emptyStates.authIllustration')}
      secondaryAction={
        <Link className={buttonVariants({ variant: 'secondary' })} href="/auth/register">{t('auth.createAccount')}</Link>
      }
      title={t('emptyStates.authTitle')}
      variant="auth"
    />
  )
}
