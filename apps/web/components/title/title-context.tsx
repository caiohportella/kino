'use client'

import type {
  NormalizedWatchProvider,
  NormalizedWatchProviders,
  TMDbTitle,
  TMDbVideo,
  WatchProviderCategory,
} from '@kino/core'
import { getTMDbImageUrl } from '@kino/core'
import { ExternalLink, Play } from 'lucide-react'
import Link from 'next/link'
import { ExternalServiceCard } from '@/components/external-links-section'
import { Poster } from '@/components/kino'
import { MediaRow } from '@/components/media/media-row'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaPoster } from '@/hooks/use-media-poster'
import { useTranslation } from '@/lib/i18n'
import { resolveProviderDestination } from '@/lib/provider-destinations'
import { cn } from '@/lib/utils'

export interface TitleContextData {
  errors: {
    franchise: boolean
    providers: boolean
    recommendations: boolean
    trailer: boolean
  }
  providers: NormalizedWatchProviders
  franchiseTitles: TMDbTitle[]
  recommendations: TMDbTitle[]
  trailer: TMDbVideo | null
}

function TitleContextPoster({ item }: { item: TMDbTitle }) {
  const { href, poster, prefetch, title, year } = useMediaPoster(item)

  return (
    <Link
      className="group min-w-0 focus-ring"
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <Poster className="w-full rounded-md" details={{ year }} src={poster} title={title} />
    </Link>
  )
}

export function FranchiseTitles({
  embedded = false,
  items,
  loading,
}: {
  embedded?: boolean
  items?: TMDbTitle[]
  loading: boolean
}) {
  const { t } = useTranslation()
  if (!loading && !items?.length) return null

  const content = (
    <div className="min-w-0">
      {embedded ? (
        <h2 className="mb-4 text-sm font-semibold text-kino-text">
          {t('title.moreFromFranchise')}
        </h2>
      ) : null}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="aspect-2/3 w-36 shrink-0 rounded-md" key={item} />
          ))}
        </div>
      ) : (
        <MediaRow aria-label={t('title.moreFromFranchise')}>
          {items?.map((item) => (
            <TitleContextPoster item={item} key={`${item.media_type}-${item.id}`} />
          ))}
        </MediaRow>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t('title.moreFromFranchise')}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">{content}</CardContent>
    </Card>
  )
}
export function TrailerCard({
  embedded = false,
  error,
  loading,
  title,
  trailer,
}: {
  embedded?: boolean
  error?: boolean
  loading: boolean
  title: string
  trailer?: TMDbVideo | null
}) {
  const { t } = useTranslation()

  if (loading) {
    const content = (
      <div className={cn('grid gap-3', embedded && 'px-5 py-4')}>
        {!embedded ? null : (
          <h2 className="text-sm font-semibold text-kino-text">{t('title.watchTrailer')}</h2>
        )}

        <Skeleton className={cn('aspect-video w-full', embedded ? 'rounded-md' : 'rounded-md')} />

        <Skeleton className="h-4 w-2/3" />
      </div>
    )

    if (embedded) {
      return <div aria-label={t('title.watchTrailer')}>{content}</div>
    }

    return (
      <Card aria-label={t('title.watchTrailer')} size="sm">
        <CardHeader>
          <CardTitle>{t('title.watchTrailer')}</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3">
          <Skeleton className="aspect-video w-full rounded-md" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!trailer) {
    if (embedded) {
      return (
        <div className="grid gap-2 px-5 py-4">
          <h2 className="text-sm font-semibold text-kino-text">{t('title.watchTrailer')}</h2>

          <p className="text-sm leading-6 text-kino-muted">
            {error ? t('title.trailerUnavailable') : t('title.noTrailer')}
          </p>
        </div>
      )
    }

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t('title.watchTrailer')}</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm leading-6 text-kino-muted">
            {error ? t('title.trailerUnavailable') : t('title.noTrailer')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const watchLabel = t('title.watchTrailerFor', { title })

  if (embedded) {
    return (
      <Dialog>
        <div className="grid gap-3">
          <DialogTriggerThumbnail embedded label={watchLabel} trailer={trailer} />

          <div className="grid gap-1 px-5 pb-4">
            <h2 className="text-sm font-semibold text-kino-text">{t('title.watchTrailer')}</h2>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-kino-text">{trailer.name}</p>

              <p className="text-xs text-kino-muted">
                {trailer.official ? t('title.officialTrailer') : trailer.type}
              </p>
            </div>
          </div>
        </div>

        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{trailer.name}</DialogTitle>
            <DialogDescription>{watchLabel}</DialogDescription>
          </DialogHeader>

          <div className="aspect-video overflow-hidden rounded-md bg-black">
            <iframe
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}`}
              title={watchLabel}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t('title.watchTrailer')}</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3">
          <DialogTriggerThumbnail label={watchLabel} trailer={trailer} />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-kino-text">{trailer.name}</p>

            <p className="text-xs text-kino-muted">
              {trailer.official ? t('title.officialTrailer') : trailer.type}
            </p>
          </div>
        </CardContent>
      </Card>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{trailer.name}</DialogTitle>
          <DialogDescription>{watchLabel}</DialogDescription>
        </DialogHeader>

        <div className="aspect-video overflow-hidden rounded-md bg-black">
          <iframe
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}`}
            title={watchLabel}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DialogTriggerThumbnail({
  embedded = false,
  label,
  trailer,
}: {
  embedded?: boolean
  label: string
  trailer: TMDbVideo
}) {
  return (
    <DialogTrigger
      aria-label={label}
      className={cn(
        'focus-ring group relative aspect-video w-full overflow-hidden bg-black',
        embedded ? 'rounded-none' : 'rounded-md'
      )}
    >
      <img
        alt=""
        className="size-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
        src={`https://i.ytimg.com/vi/${encodeURIComponent(trailer.key)}/hqdefault.jpg`}
      />

      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-12 place-items-center rounded-full bg-kino-accent text-black shadow-soft transition-transform group-hover:scale-105">
          <Play aria-hidden="true" fill="currentColor" />
        </span>
      </span>
    </DialogTrigger>
  )
}
const PROVIDER_CATEGORIES: WatchProviderCategory[] = ['stream', 'free', 'ads', 'rent', 'buy']

export function WatchProvidersCard({
  embedded = false,
  error,
  loading,
  media,
  providers,
}: {
  embedded?: boolean
  error?: boolean
  loading: boolean
  media: {
    mediaType: 'movie' | 'tv'
    releaseYear?: number
    title: string
    tmdbId: number
  }
  providers?: NormalizedWatchProviders
}) {
  const { t } = useTranslation()

  if (loading) {
    if (embedded) {
      return (
        <div aria-label={t('title.whereToWatch')} className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="text-sm font-semibold text-kino-text">{t('title.whereToWatch')}</h2>

            <Skeleton className="h-3 w-20" />
          </div>

          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((item) => (
              <Skeleton className="h-10 w-24 rounded-md" key={item} />
            ))}
          </div>
        </div>
      )
    }

    return (
      <Card aria-label={t('title.whereToWatch')} size="sm">
        <CardHeader>
          <CardTitle>{t('title.whereToWatch')}</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-[repeat(auto-fill,96px)] gap-3">
          {[0, 1, 2].map((item) => (
            <Skeleton className="size-24 rounded-md" key={item} />
          ))}
        </CardContent>
      </Card>
    )
  }

  const hasProviders = PROVIDER_CATEGORIES.some(
    (category) => (providers?.groups[category]?.length || 0) > 0
  )

  const content = (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2
          className={cn(
            embedded
              ? 'text-sm font-semibold text-kino-text'
              : 'text-base font-semibold text-kino-text'
          )}
        >
          {t('title.whereToWatch')}
        </h2>

        {providers?.region ? (
          <p className="text-xs text-kino-muted">
            {t('title.availableIn', {
              region: regionName(providers.region),
            })}
          </p>
        ) : null}
      </div>

      {hasProviders ? (
        <div className="grid gap-4">
          {PROVIDER_CATEGORIES.map((category) => {
            const items = providers?.groups[category]

            if (!items?.length) {
              return null
            }

            return (
              <section className="grid gap-2" key={category}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-kino-subtle">
                  {t(`title.providerCategories.${category}`)}
                </h3>

                <div
                  className={cn(
                    embedded
                      ? 'flex flex-wrap gap-2'
                      : 'grid grid-cols-[repeat(auto-fill,96px)] gap-3'
                  )}
                >
                  {items.map((provider) => (
                    <WatchProviderServiceCard
                      embedded={embedded}
                      key={`${category}-${provider.provider_id}`}
                      media={media}
                      provider={provider}
                      region={providers?.region || 'US'}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="text-sm leading-6 text-kino-muted">
          {error ? t('title.providersUnavailable') : t('title.noProviders')}
        </p>
      )}

      {providers?.link && hasProviders ? (
        <a
          aria-label={t('title.viewWatchOptions')}
          className={cn(
            buttonVariants({
              size: 'sm',
              variant: embedded ? 'ghost' : 'secondary',
            }),
            embedded
              ? 'h-auto w-fit justify-start px-0 py-0 text-xs text-kino-muted hover:bg-transparent hover:text-kino-text'
              : 'w-full'
          )}
          href={providers.link}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('title.viewWatchOptions')}

          <ExternalLink aria-hidden="true" data-icon="inline-end" />
        </a>
      ) : null}

      <p className="text-xs leading-5 text-kino-subtle">{t('title.justWatchAttribution')}</p>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <Card size="sm">
      <CardContent className="pt-5">{content}</CardContent>
    </Card>
  )
}

function WatchProviderServiceCard({
  embedded = false,
  media,
  provider,
  region,
}: {
  embedded?: boolean
  media: {
    mediaType: 'movie' | 'tv'
    releaseYear?: number
    title: string
    tmdbId: number
  }
  provider: NormalizedWatchProvider
  region: string
}) {
  const { t } = useTranslation()

  const destination = resolveProviderDestination({
    mediaType: media.mediaType,
    providerId: provider.provider_id,
    providerName: provider.provider_name,
    region,
    releaseYear: media.releaseYear,
    title: media.title,
    tmdbId: media.tmdbId,
  })

  return (
    <ExternalServiceCard
      accessibleLabel={
        destination.kind === 'search'
          ? t('title.searchForOn', {
              provider: provider.provider_name,
              title: media.title,
            })
          : destination.kind === 'direct'
            ? t('title.watchOnProvider', {
                provider: provider.provider_name,
                title: media.title,
              })
            : t('title.openProvider', {
                provider: provider.provider_name,
              })
      }
      brandColor={getProviderBrandColor(provider.provider_name)}
      embedded={embedded}
      href={destination.webUrl}
      iconUrl={getTMDbImageUrl(provider.logo_path, 'w200') || undefined}
      label={provider.provider_name}
    />
  )
}

export function MoreLikeThis({
  embedded = false,
  error,
  items,
  loading,
}: {
  embedded?: boolean
  error?: boolean
  items?: TMDbTitle[]
  loading: boolean
}) {
  const { t } = useTranslation()

  const content = (
    <div className="min-w-0">
      {embedded ? (
        <h2 className="mb-4 text-sm font-semibold text-kino-text">{t('title.moreLikeThis')}</h2>
      ) : null}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="aspect-2/3 w-36 shrink-0 rounded-md" key={item} />
          ))}
        </div>
      ) : items?.length ? (
        <MediaRow aria-label={t('title.moreLikeThis')}>
          {items.map((item) => (
            <TitleContextPoster item={item} key={`${item.media_type}-${item.id}`} />
          ))}
        </MediaRow>
      ) : (
        <p className="text-sm leading-6 text-kino-muted">
          {error ? t('title.recommendationsUnavailable') : t('title.noRecommendations')}
        </p>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t('title.moreLikeThis')}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">{content}</CardContent>
    </Card>
  )
}
function regionName(region: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(region) || region
  } catch {
    return region
  }
}

const PROVIDER_BRAND_COLORS: [RegExp, string][] = [
  [/amazon|prime video/i, '#00a8e1'],
  [/apple tv/i, '#ffffff'],
  [/google play/i, '#34a853'],
  [/claro/i, '#da291c'],
  [/filmelier/i, '#e6a400'],
  [/netflix/i, '#e50914'],
  [/disney/i, '#113ccf'],
  [/\bmax\b|hbo/i, '#5b32d6'],
  [/globoplay/i, '#e51b23'],
  [/paramount/i, '#0064ff'],
  [/mubi/i, '#0b5fff'],
]

function getProviderBrandColor(providerName: string) {
  return PROVIDER_BRAND_COLORS.find(([pattern]) => pattern.test(providerName))?.[1] || '#6b7280'
}
