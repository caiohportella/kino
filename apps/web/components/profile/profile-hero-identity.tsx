'use client'

import type { UserProfile } from '@kino/core'
import { CalendarDays, ChartNoAxesCombined } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ProfileShareButton } from '@/components/profile/profile-share-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/lib/localization/i18n'
import { Button } from '../ui/button'

export type ProfileHeroIdentityProps = {
  children?: ReactNode
  followControl?: ReactNode
  mutualSinceLabel?: string | null
  profile: UserProfile
}

export function ProfileHeroIdentity({
  children,
  followControl,
  mutualSinceLabel,
  profile,
  statisticsHref,
}: {
  children?: ReactNode
  followControl?: ReactNode
  mutualSinceLabel?: string | null
  profile: UserProfile
  statisticsHref?: string
}) {
  const { t } = useTranslation()

  return (
    <div
      className="
        grid w-full min-w-0
        grid-cols-[auto_minmax(0,1fr)]
        items-end gap-x-5 gap-y-5
        lg:grid-cols-[128px_minmax(0,1fr)_auto]
        lg:gap-x-6
      "
    >
      <Avatar
        className="
          size-24
          rounded-md
          border-4 border-kino-surface
          bg-kino-panel
          shadow-[0_18px_42px_rgb(0_0_0/0.35)]

          sm:size-32
          lg:size-32
        "
      >
        <AvatarImage alt="" className="rounded-md" src={profile.avatar_url || undefined} />

        <AvatarFallback className="text-3xl">
          {profile.display_name || profile.username || t('profile.user')}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        {mutualSinceLabel ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-kino-muted">
            <CalendarDays aria-hidden="true" size={14} />
            {mutualSinceLabel}
          </div>
        ) : null}

        <div className="text-sm font-semibold text-white/65">
          {profile.username ? `@${profile.username}` : t('profile.title')}
        </div>

        <h1
          className="
            mt-1
            text-3xl font-semibold
            tracking-tight
            text-kino-text

            sm:text-4xl
            lg:text-3xl
          "
        >
          {profile.display_name || profile.username || t('profile.user')}
        </h1>

        {profile.bio ? (
          <p
            className="
              mt-2
              max-w-2xl
              text-sm leading-6
              text-white/70
            "
          >
            {profile.bio}
          </p>
        ) : null}

        {children}
      </div>

      <div
        className="
              col-span-2
              flex flex-wrap items-center gap-3
              lg:col-span-1
              lg:justify-self-end
            "
      >
        {statisticsHref ? (
          <Button render={<Link href={statisticsHref} />} size="lg" variant="secondary">
            <ChartNoAxesCombined aria-hidden="true" size={16} />
            {t('stats.viewStatistics')}
          </Button>
        ) : null}

        {profile.username ? <ProfileShareButton username={profile.username} /> : null}

        {followControl}
      </div>
    </div>
  )
}
