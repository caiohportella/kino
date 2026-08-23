'use client'

import { UserPlus, UserRoundCheck } from 'lucide-react'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState } from '@/components/kino'
import { ProfileDashboardHero } from '@/components/profile/profile-dashboard-hero'
import { ProfileOverview } from '@/components/profile/profile-overview'
import { ProfileRelationshipAction } from '@/components/profile/profile-section-state'
import { ProfileSocialListDialog } from '@/components/profile/profile-social-list-dialog'
import { ProfileSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { useProfileSocial } from '@/hooks/profile/use-profile-social'
import { type ProfileViewProps, useProfileView } from '@/hooks/profile/use-profile-view'
import { useTranslation } from '@/lib/localization/i18n'

export function ProfileView(props: ProfileViewProps) {
  const { t } = useTranslation()

  const profileView = useProfileView(props)

  const social = useProfileSocial({
    isFollowingTarget: profileView.relationship.isFollowing,

    targetUserId: profileView.targetUserId,

    viewerId: profileView.viewerId,

    visibilityScope: profileView.visibilityScope,
  })

  if (profileView.status === 'loading') {
    return <ProfileSkeleton label={t('common.loading')} />
  }

  if (profileView.status === 'protected') {
    return <ProtectedEmpty />
  }

  if (profileView.status === 'error' || !profileView.profile) {
    return <EmptyState body={t('common.tryAgain')} title={t('profile.title')} />
  }

  const profile = profileView.profile

  const profileAction =
    !profileView.isOwnProfile && profileView.viewerId ? (
      <ProfileRelationshipAction
        query={profileView.relationshipQuery}
        state={profileView.relationshipState}
      >
        <Button disabled={social.followTarget.isPending} onClick={social.followTarget.toggle}>
          {profileView.relationship.isFollowing ? (
            <UserRoundCheck aria-hidden="true" size={16} />
          ) : (
            <UserPlus aria-hidden="true" size={16} />
          )}

          {profileView.relationship.isFollowing
            ? t('profile.following')
            : profileView.relationship.isFollowedBy
              ? t('profile.followBack')
              : t('profile.follow')}
        </Button>
      </ProfileRelationshipAction>
    ) : null

  return (
    <div className="content-frame">
      <ProfileDashboardHero
        followControl={profileAction}
        mutualSinceLabel={profileView.mutualSinceLabel}
        profile={profile}
        stats={{
          ...profileView.stats,

          onFollowersClick: social.openFollowers,

          onFollowingClick: social.openFollowing,
        }}
        statisticsHref={
          profileView.isOwnProfile && profileView.profile.username
            ? `/${profileView.profile.username}/stats`
            : undefined
        }
      />

      <ProfileOverview {...profileView.overview} />

      <ProfileSocialListDialog {...social.dialog} />
    </div>
  )
}
