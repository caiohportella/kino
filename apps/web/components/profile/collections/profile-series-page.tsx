'use client'

import { ProfileCollectionPage } from '@/components/profile/collections/profile-collection-page'
import { useTranslation } from '@/lib/localization/i18n'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export function ProfileSeriesPage({
  displayName,
  profileId,
  username,
}: {
  displayName: string
  profileId: string
  username: string
}) {
  const { t } = useTranslation()
  const viewer = useAuthStore((state) => state.user)

  const visibilityScope = viewer?.id
    ? ({ kind: 'authenticated', userId: viewer.id } as const)
    : ({ kind: 'public' } as const)

  return (
    <ProfileCollectionPage
      backLabel={t('profileCollections.backToProfile', {
        defaultValue: 'Back to profile',
      })}
      description={t('profileCollections.seriesDescription', {
        defaultValue: 'Series watched by {{name}}.',
        name: displayName,
      })}
      emptyBody={t('profileCollections.seriesEmptyBody', {
        defaultValue: 'Watched series will appear here.',
      })}
      emptyTitle={t('profileCollections.seriesEmptyTitle', {
        defaultValue: 'No series yet',
      })}
      errorBody={t('profileCollections.loadErrorBody', {
        defaultValue: 'Try again in a moment.',
      })}
      errorTitle={t('profileCollections.loadErrorTitle', {
        defaultValue: 'Could not load collection',
      })}
      mediaType="tv"
      noMatchesBody={t('profileCollections.noMatchesBody', {
        defaultValue: 'Try adjusting or clearing your filters.',
      })}
      noMatchesTitle={t('profileCollections.noMatchesTitle', {
        defaultValue: 'No matches',
      })}
      profileHref={`/${encodeURIComponent(username)}`}
      profileId={profileId}
      service={db}
      shareText={t('profileCollections.seriesShareText', {
        defaultValue: "See {{name}}'s series on Kino.",
        name: displayName,
      })}
      title={t('profileCollections.seriesTitle', {
        defaultValue: "{{name}}'s series",
        name: displayName,
      })}
      visibilityScope={visibilityScope}
    />
  )
}
