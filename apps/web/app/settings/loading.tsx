import { SettingsSkeleton } from '@/components/skeletons/page-skeletons'
import { getServerMetadataContext } from '@/lib/server-metadata'

export default async function Loading() {
  const { t } = await getServerMetadataContext()
  return <SettingsSkeleton label={t('common.loading')} />
}
