import { ProfileStatSummaryCard } from '@/components/profile/profile-stat-summary-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getServerMetadataContext } from '@/lib/server-metadata'

export default async function Loading() {
  const { t } = await getServerMetadataContext()
  return (
    <div aria-busy="true" className="content-frame grid gap-6" role="status">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="grid gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64 max-w-[80vw]" />
      </div>
      <ProfileStatSummaryCard loading />
      <Skeleton className="h-28 w-full rounded-md" />
    </div>
  )
}
