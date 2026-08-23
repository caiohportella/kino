'use client'

import { ShareButton } from '@/components/share-button'
import { useTranslation } from '@/lib/localization/i18n'

export function ProfileShareButton({ username }: { username: string }) {
  const { t } = useTranslation()
  return (
    <ShareButton
      label={t('profile.shareProfile')}
      text={t('sharing.profileText', { username })}
      title={`@${username}`}
      url={`/${username}`}
    />
  )
}
