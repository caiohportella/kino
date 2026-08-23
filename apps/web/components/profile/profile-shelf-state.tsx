'use client'

import { EmptyState } from '@/components/kino'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/localization/i18n'

export function ProfileShelfSkeleton({ title }: { title: string }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-kino-text">{title}</h2>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton
            className="aspect-2/3 w-full rounded-md"
            key={`profile-shelf-skeleton-${index}`}
          />
        ))}
      </div>
    </section>
  )
}

export function ProfileShelfError({ title }: { title: string }) {
  const { t } = useTranslation()

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-kino-text">{title}</h2>

      <EmptyState
        body={t('common.tryAgain')}
        size="compact"
        title={t('common.failed')}
        variant="missing"
      />
    </section>
  )
}
