'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Poster } from '@/components/kino'

export type TitleCardItem = {
  id: string
  href: string
  title: string
  imageUrl: string | null
  imageAlt: string
  subtitle?: string
  badge?: string
}

export function TitleCard({ children, item }: { children?: ReactNode; item: TitleCardItem }) {
  return (
    <Link className="group grid min-w-0 content-start gap-3 focus-ring" href={item.href}>
      <Poster
        alt={item.imageAlt}
        className="w-full rounded-md"
        src={item.imageUrl}
        title={item.title}
      />
      <div className="min-w-0">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text group-hover:text-kino-accent">
          {item.title}
        </h3>
        {item.subtitle ? <p className="mt-1 text-xs text-kino-muted">{item.subtitle}</p> : null}
        {item.badge ? (
          <span className="mt-3 inline-flex min-h-7 items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-3 text-xs font-semibold text-kino-text">
            {item.badge}
          </span>
        ) : null}
        {children}
      </div>
    </Link>
  )
}
