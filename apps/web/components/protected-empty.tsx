'use client'

import { Button, EmptyState } from '@kino/ui'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function ProtectedEmpty({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()

  return (
    <EmptyState
      action={
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Link href="/auth/login">
            <Button>{t('auth.signIn')}</Button>
          </Link>
          <Link href="/auth/register">
            <Button tone="secondary">{t('auth.createAccount')}</Button>
          </Link>
        </div>
      }
      body={body}
      title={title}
    />
  )
}
