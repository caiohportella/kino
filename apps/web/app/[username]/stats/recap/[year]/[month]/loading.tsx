import { Skeleton } from '@/components/ui/skeleton'
import { getServerMetadataContext } from '@/lib/seo/server-metadata'

export default async function Loading() {
  const { t } = await getServerMetadataContext()
  return (
    <div aria-busy="true" className="content-frame grid gap-6" role="status">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-md" />
        <Skeleton className="h-80 w-full rounded-md" />
      </div>
      <Skeleton className="h-80 w-full rounded-md" />
    </div>
  )
}
