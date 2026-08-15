import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ExternalLinkProvider = {
  brandColor: string
  href: string
  icon?: ReactNode
  iconUrl?: string
  label: string
}

export function ExternalServiceCard({
  accessibleLabel,
  brandColor,
  href,
  icon,
  iconUrl,
  label,
  embedded = false,
}: Omit<ExternalLinkProvider, 'href'> & {
  accessibleLabel?: string
  href: string
  embedded?: boolean
}) {
  const content = (
    <>
      {iconUrl ? (
        <img
          alt=""
          className={cn(
            'shrink-0 object-contain transition-transform group-hover:scale-105',
            embedded ? 'size-6 rounded-sm' : 'size-8'
          )}
          decoding="async"
          loading="lazy"
          src={iconUrl}
        />
      ) : (
        <span
          className={cn(
            'grid shrink-0 place-items-center',
            icon && 'text-kino-accent',
            embedded ? 'size-6' : 'size-8'
          )}
        >
          {icon || label.slice(0, 1)}
        </span>
      )}

      <span
        className={cn(
          'min-w-0 truncate',
          embedded
            ? 'text-xs font-medium'
            : 'line-clamp-2 max-w-full text-xs font-semibold leading-4'
        )}
        title={label}
      >
        {label}
      </span>
    </>
  )

  return (
    <Link
      aria-label={accessibleLabel || `Open ${label}`}
      className={cn(
        'group min-w-0 border border-white/10 text-kino-muted transition-colors hover:border-white/20 hover:text-kino-text focus-ring',
        embedded
          ? 'flex h-10 max-w-full items-center gap-2 rounded-md px-2.5'
          : 'flex size-24 flex-col items-center justify-center gap-2 rounded-md p-3 text-center'
      )}
      href={href}
      rel="noopener noreferrer"
      style={{
        backgroundColor: `${brandColor}${embedded ? '0D' : '12'}`,
      }}
      target="_blank"
    >
      {content}
    </Link>
  )
}

export function ExternalLinksSection({
  className,
  compact = false,
  embedded = false,
  providers,
  title = 'External links',
}: {
  className?: string
  compact?: boolean
  embedded?: boolean
  providers: Array<ExternalLinkProvider | null | undefined | false>
  title?: string
}) {
  const availableProviders = providers.filter(
    (provider): provider is ExternalLinkProvider =>
      typeof provider === 'object' && provider !== null && Boolean(provider.href)
  )

  if (availableProviders.length === 0) return null

  return (
    <section className={className}>
      {title ? (
        <h2
          className={cn('font-semibold text-kino-text', embedded ? 'mb-3 text-sm' : 'mb-4 text-xl')}
        >
          {title}
        </h2>
      ) : null}

      <div
        className={cn(
          embedded ? 'flex flex-wrap gap-2' : 'grid gap-3',
          !embedded &&
            (compact
              ? 'grid-cols-[repeat(auto-fill,96px)]'
              : 'grid-cols-[repeat(auto-fit,minmax(96px,1fr))]')
        )}
      >
        {availableProviders.map((provider) => (
          <ExternalServiceCard
            {...provider}
            embedded={embedded}
            key={`${provider.label}-${provider.href}`}
          />
        ))}
      </div>
    </section>
  )
}
