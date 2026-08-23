'use client'

import type { UserProfile } from '@kino/core'
import type { ReactNode } from 'react'
import { ProfileHeroIdentity } from '@/components/profile/profile-hero-identity'
import {
  ProfileHeroStats,
  type ProfileHeroStatsProps,
} from '@/components/profile/profile-hero-stats'

export type ProfileDashboardHeroProps = {
  followControl?: ReactNode
  mutualSinceLabel?: string | null
  profile: UserProfile
  stats: ProfileHeroStatsProps
  statisticsHref?: string
}

export function ProfileDashboardHero({
  followControl,
  mutualSinceLabel,
  profile,
  stats,
  statisticsHref,
}: ProfileDashboardHeroProps) {
  return (
    <>
      <section
        className="
          relative mb-6
          min-h-[clamp(460px,48vh,580px)]
          overflow-hidden
          rounded-md
          border border-white/10
          bg-kino-surface
        "
      >
        <ProfileHeroBackground bannerUrl={profile.banner_url} />

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-kino-surface via-kino-surface/40 to-black/5" />

        <div className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-black/45 via-black/15 to-black/25 lg:block" />

        <div
          className="
            relative z-10
            flex
            min-h-[clamp(460px,48vh,580px)]
            items-end
            p-5

            sm:p-8

            lg:px-[clamp(32px,3vw,56px)]
            lg:py-10
          "
        >
          <ProfileHeroIdentity
            followControl={followControl}
            mutualSinceLabel={mutualSinceLabel}
            profile={profile}
            statisticsHref={statisticsHref}
          />
        </div>
      </section>

      <ProfileHeroStats {...stats} />
    </>
  )
}

function ProfileHeroBackground({ bannerUrl }: { bannerUrl?: string | null }) {
  return (
    <div className="absolute inset-0 bg-kino-panel">
      {bannerUrl ? (
        <img alt="" className="size-full object-cover" src={bannerUrl} />
      ) : (
        <div className="size-full bg-[linear-gradient(135deg,rgb(29_185_84/0.18),rgb(255_255_255/0.06)_42%,rgb(0_0_0/0.16))]" />
      )}
    </div>
  )
}
