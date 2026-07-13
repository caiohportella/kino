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
            ? 'grid-cols-[repeat(auto-fill,84px)]'
            : 'grid-cols-[repeat(auto-fit,minmax(84px,1fr))]'
        )}
      >
        {availableProviders.map((provider) => (
          <Link
            aria-label={`Open ${provider.label}`}
            className="group flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-md border border-white/10 p-3 text-center text-xs font-semibold text-kino-muted transition-colors hover:border-white/20 hover:text-kino-text focus-ring"
            href={provider.href}
            key={`${provider.label}-${provider.href}`}
            rel="noreferrer"
            style={{ backgroundColor: `${provider.brandColor}12` }}
            target="_blank"
          >
            {provider.iconUrl ? (
              <img
                alt=""
                className="size-8 object-contain transition-transform group-hover:scale-105"
                decoding="async"
                loading="lazy"
                src={provider.iconUrl}
              />
            ) : (
              <span
                className={cn(
                  'grid size-8 place-items-center',
                  provider.icon && 'text-kino-accent'
                )}
              >
                {provider.icon}
              </span>
            )}
            <span className="max-w-full truncate">{provider.label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
