'use client'

import type { PublicUserSummary } from '@kino/core'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function ReviewAuthor({
  author,
  size = 'default',
}: {
  author: PublicUserSummary
  size?: 'default' | 'sm' | 'lg'
}) {
  const name = author.displayName || author.username || 'Kino user'
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const href = author.username ? `/${encodeURIComponent(author.username)}` : '#'

  return (
    <Link
      aria-label={name}
      className="focus-ring shrink-0 rounded-full"
      href={href}
      tabIndex={author.username ? 0 : -1}
    >
      <Avatar size={size}>
        {author.avatarUrl ? <AvatarImage alt={`${name}'s avatar`} src={author.avatarUrl} /> : null}
        <AvatarFallback aria-hidden="true">{initials || '?'}</AvatarFallback>
      </Avatar>
    </Link>
  )
}
