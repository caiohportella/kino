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
}: Omit<ExternalLinkProvider, 'href'> & {
  accessibleLabel?: string
  href: string
}) {
  const className =
    'group flex size-24 min-w-0 flex-col items-center justify-center gap-2 rounded-md border border-white/10 p-3 text-center text-xs font-semibold text-kino-muted transition-colors hover:border-white/20 hover:text-kino-text focus-ring'
  const content = (
    <>
      {iconUrl ? (
        <img
          alt={`${label} logo`}
          className="size-8 object-contain transition-transform group-hover:scale-105"
          decoding="async"
          loading="lazy"
          src={iconUrl}
        />
      ) : (
        <span className={cn('grid size-8 place-items-center', icon && 'text-kino-accent')}>
          {icon || label.slice(0, 1)}
        </span>
      )}
      <span className="line-clamp-2 max-w-full leading-4" title={label}>
        {label}
      </span>
    </>
  )

  return (
    <Link
      aria-label={accessibleLabel || `Open ${label}`}
      className={className}
      href={href}
      rel="noopener noreferrer"
      style={{ backgroundColor: `${brandColor}12` }}
      target="_blank"
    >
      {content}
    </Link>
  )
}

export function ExternalLinksSection({
  className,
  compact = false,
  providers,
  title = 'External links',
}: {
  className?: string
  compact?: boolean
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
      <h2 className="mb-4 text-xl font-semibold text-kino-text">{title}</h2>
      <div
        className={cn(
          'grid gap-3',
          compact
            ? 'grid-cols-[repeat(auto-fill,96px)]'
            : 'grid-cols-[repeat(auto-fit,minmax(96px,1fr))]'
        )}
      >
        {availableProviders.map((provider) => (
          <ExternalServiceCard {...provider} key={`${provider.label}-${provider.href}`} />
        ))}
      </div>
    </section>
  )
}
