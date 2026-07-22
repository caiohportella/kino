'use client'

import { UserRound } from 'lucide-react'
import Link from 'next/link'
import type { Ref } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ProfileSearchCardProps = {
  active?: boolean
  avatarUrl?: string | null
  backgroundUrl?: string | null
  entityLabel: string
  href: string
  id?: string
  imageFallbackLabel: string
  linkRef?: Ref<HTMLAnchorElement>
  name: string
  role?: string
  subtitle?: string
  username?: string
}

export function ProfileSearchCard({
  active,
  avatarUrl,
  backgroundUrl,
  entityLabel,
  href,
  id,
  imageFallbackLabel,
  linkRef,
  name,
  role,
  subtitle,
  username,
}: ProfileSearchCardProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <Link
      aria-label={`${name}, ${entityLabel}`}
      aria-selected={active}
      className={cn(
        'focus-ring group relative grid min-h-64 min-w-0 overflow-hidden rounded-md border border-white/10 bg-kino-panel p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-kino-accent/50 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none',
        active && 'border-kino-accent ring-2 ring-kino-accent/30'
      )}
      href={href}
      id={id}
      ref={linkRef}
      role={role}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {backgroundUrl ? (
          <img
            alt=""
            className="size-full scale-105 object-cover object-center brightness-[0.55] blur-[2px] transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transition-none"
            loading="lazy"
            src={backgroundUrl}
          />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_50%_25%,color-mix(in_oklch,var(--primary),transparent_68%),transparent_52%),linear-gradient(145deg,var(--muted),var(--background))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/35 to-background/95" />
      </div>

      <div className="relative z-10 grid min-w-0 grid-rows-[1fr_auto] justify-items-center gap-4 text-center">
        <Avatar className="size-24 self-center rounded-full border-2 border-background/80 bg-kino-surface shadow-md ring-1 ring-white/15">
          <AvatarImage alt={name} className="object-cover" src={avatarUrl || undefined} />
          <AvatarFallback className="text-xl font-semibold">
            {initials || <UserRound aria-hidden="true" />}
            <span className="sr-only">{imageFallbackLabel}</span>
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 self-end">
          <span className="block truncate text-base font-semibold text-foreground group-hover:text-kino-accent">
            {name}
          </span>
          {username ? <span className="mt-1 block truncate text-sm text-muted-foreground">@{username}</span> : null}
          {subtitle ? <span className="mt-1 block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
        </span>
      </div>
    </Link>
  )
}

export function ProfileSearchCardSkeleton() {
  return (
    <div className="grid min-h-64 grid-rows-[1fr_auto] justify-items-center gap-4 rounded-md border border-white/10 bg-kino-panel p-4">
      <Skeleton className="size-24 self-center rounded-full" />
      <div className="grid w-full justify-items-center gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
