'use client'

import { ProfileCollectionPage } from '@/components/profile/collections/profile-collection-page'
import { useTranslation } from '@/lib/localization/i18n'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export function ProfileMoviesPage({
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
      emptyBody={t('profileCollections.moviesEmptyBody', {
        defaultValue: 'Watched movies will appear here.',
      })}
      emptyTitle={t('profileCollections.moviesEmptyTitle', {
        defaultValue: 'No movies yet',
      })}
      errorBody={t('profileCollections.loadErrorBody', {
        defaultValue: 'Try again in a moment.',
      })}
      errorTitle={t('profileCollections.loadErrorTitle', {
        defaultValue: 'Could not load collection',
      })}
      mediaType="movie"
      noMatchesBody={t('profileCollections.noMatchesBody', {
        defaultValue: 'Try adjusting or clearing your filters.',
      })}
      noMatchesTitle={t('profileCollections.noMatchesTitle', {
        defaultValue: 'No matches',
      })}
      profileHref={`/${encodeURIComponent(username)}`}
      profileId={profileId}
      service={db}
      shareText={t('profileCollections.moviesShareText', {
        defaultValue: "See {{name}}'s movies on Kino.",
        name: displayName,
      })}
      title={t('profileCollections.moviesTitle', {
        defaultValue: "{{name}}'s movies",
        name: displayName,
      })}
      visibilityScope={visibilityScope}
    />
  )
}
