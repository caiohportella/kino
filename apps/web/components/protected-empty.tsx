'use client'

import { Button, EmptyState } from '@kino/ui'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function ProtectedEmpty({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()

  return (
    <EmptyState
      action={
        <Link href="/auth/login">
          <Button>{t('auth.signIn')}</Button>
        </Link>
      }
      body={body}
      title={title}
    />
  )
}
