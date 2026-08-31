'use client'

import type { FollowerInfo } from '@kino/core'
import { LoaderCircle } from 'lucide-react'
import { DisplayTitle } from '@/components/media/display-title'
import { ProfileUserRow } from '@/components/profile/profile-user-row'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/localization/i18n'

export type SocialListType = 'followers' | 'following'

export function ProfileSocialListDialog({
  actionPending,
  error,
  listType,
  loading,
  onAction,
  onOpenChangeAction,
  open,
  pendingUserId,
  users,
}: {
  actionPending: boolean
  error: Error | null
  listType: SocialListType | null
  loading: boolean
  onAction: (profile: FollowerInfo) => void
  onOpenChangeAction: (open: boolean) => void
  open: boolean
  pendingUserId?: string
  users: FollowerInfo[]
}) {
  const { t } = useTranslation()

  const title = listType === 'following' ? t('profile.following') : t('profile.followers')

  return (
    <Dialog onOpenChange={onOpenChangeAction} open={open}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black italic tracking-normal sm:text-3xl">
            <DisplayTitle title={title} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[58vh] gap-2 overflow-y-auto pr-1">
          {loading ? <SocialListLoadingState /> : null}

          {error ? (
            <SocialListEmptyState body={t('common.tryAgain')} title={t('common.failed')} />
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <SocialListEmptyState
              body={t('profile.noUsersFound')}
              title={t('profile.noUsersFound')}
            />
          ) : null}

          {!loading && !error
            ? users.map((profile) => {
                const isPending = actionPending && pendingUserId === profile.id

                const actionLabel = profile.isFollowing
                  ? t('profile.unfollow')
                  : profile.isFollowedBy
                    ? t('profile.followBack')
                    : t('profile.follow')

                return (
                  <ProfileUserRow
                    action={
                      !profile.isSelf ? (
                        <Button
                          aria-label={isPending ? t('profile.followingUser') : actionLabel}
                          disabled={actionPending}
                          onClick={() => onAction(profile)}
                          size="sm"
                          variant="secondary"
                        >
                          {isPending ? (
                            <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
                          ) : null}

                          {isPending ? t('profile.followingUser') : actionLabel}
                        </Button>
                      ) : null
                    }
                    key={profile.id}
                    profile={profile}
                  />
                )
              })
            : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SocialListLoadingState() {
  return (
    <div aria-hidden="true" className="grid gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3"
          key={`social-list-loading-${index}`}
        >
          <Skeleton className="size-12 shrink-0 rounded-full" />

          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>

          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  )
}

function SocialListEmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-white/10 bg-white/2.5 p-6 text-center">
      <div>
        <div className="font-semibold text-kino-text">{title}</div>

        <p className="mt-1 text-sm text-kino-muted">{body}</p>
      </div>
    </div>
  )
}
