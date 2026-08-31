'use client'

import { ShareButton } from '@/components/share-button'
import { useTranslation } from '@/lib/localization/i18n'

export function ProfileShareButton({
  className,
  username,
}: {
  className?: string
  username: string
}) {
  const { t } = useTranslation()
  return (
    <ShareButton
      className={className}
      label={t('profile.shareProfile')}
      text={t('sharing.profileText', { username })}
      title={`@${username}`}
      url={`/${username}`}
    />
  )
}
