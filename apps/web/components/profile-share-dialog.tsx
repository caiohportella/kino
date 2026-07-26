'use client'

import { ShareButton } from '@/components/share-button'
import { useTranslation } from '@/lib/i18n'
import { ogImagePath } from '@/lib/routes'

export function ProfileShareDialog({ username }: { username: string }) {
  const { t } = useTranslation()
  return (
    <ShareButton
      imageUrl={ogImagePath('profile', username)}
      label={t('profile.shareProfile')}
      subtitle={`@${username}`}
      text={t('sharing.profileText', { username })}
      title={`@${username}`}
      type="profile"
      url={`/${username}`}
    />
  )
}
