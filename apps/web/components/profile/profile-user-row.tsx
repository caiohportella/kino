'use client'

import type { UserProfile } from '@kino/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/lib/localization/i18n'

export function ProfileUserRow({ action, profile }: { action?: ReactNode; profile: UserProfile }) {
  const { t } = useTranslation()

  const displayName = profile.display_name || profile.username || t('profile.user')

  const username = profile.username ? `@${profile.username}` : t('profile.title')

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <Link
        className="focus-ring group flex min-w-0 flex-1 items-center gap-3 rounded-md"
        href={profile.username ? `/${profile.username}` : '/settings'}
      >
        <Avatar className="h-12 w-12 rounded-full">
          <AvatarImage alt="" src={profile.avatar_url || undefined} />

          <AvatarFallback>{getInitials(profile)}</AvatarFallback>
        </Avatar>

        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-kino-text group-hover:text-kino-accent">
            {displayName}
          </span>

          <span className="block truncate text-xs text-kino-muted">{username}</span>
        </span>
      </Link>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function getInitials(profile: Pick<UserProfile, 'display_name' | 'username'>) {
  const value = profile.display_name || profile.username || 'K'

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
