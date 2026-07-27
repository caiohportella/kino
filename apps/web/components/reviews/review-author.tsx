'use client'

import { getReviewAuthorLabel, type PublicUserSummary } from '@kino/core'
import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/lib/i18n'
import { normalizeProfileUsername } from '@/lib/profile-routes'

export function ReviewAuthor({
  author,
  size = 'default',
  variant = 'avatar',
}: {
  author: PublicUserSummary
  size?: 'default' | 'sm' | 'lg'
  variant?: 'avatar' | 'name'
}) {
  const { t } = useTranslation()
  const name = getReviewAuthorLabel(author) ?? t('reviews.user')
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const username = author.username ? normalizeProfileUsername(author.username) : null
  const href = username ? `/${encodeURIComponent(username)}` : null
  const content: ReactNode =
    variant === 'name' ? (
      name
    ) : (
      <Avatar size={size}>
        {author.avatarUrl ? (
          <AvatarImage alt={name} src={author.avatarUrl} />
        ) : null}
        <AvatarFallback aria-hidden="true">{initials || '?'}</AvatarFallback>
      </Avatar>
    )

  if (!href) {
    return variant === 'name' ? (
      <strong className="font-semibold text-kino-text">{content}</strong>
    ) : (
      <span aria-label={name} className="shrink-0 rounded-full">
        {content}
      </span>
    )
  }

  const stopCardNavigation = (event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()

  return (
    <Link
      aria-label={name}
      className={
        variant === 'name'
          ? 'focus-ring rounded-sm font-semibold text-kino-text underline-offset-4 hover:text-kino-accent hover:underline'
          : 'focus-ring shrink-0 rounded-full'
      }
      href={href}
      onClick={stopCardNavigation}
    >
      {content}
    </Link>
  )
}
