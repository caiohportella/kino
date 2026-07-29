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
import { ExternalServiceCard } from '@/components/external-links-section'
import { MediaCard } from '@/components/media-card'
import { MediaRow } from '@/components/media-row'
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
import { useTranslation } from '@/lib/i18n'
import { resolveLocalizedTitlePresentation } from '@/lib/localized-title-presentation'
import { resolveProviderDestination } from '@/lib/provider-destinations'
import { useLocalizedTitles } from '@/lib/use-localized-titles'
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

export function FranchiseTitles({ items, loading }: { items?: TMDbTitle[]; loading: boolean }) {
  const { t } = useTranslation()
  const localizedTitles = useLocalizedTitles(localizationRequests(items))
  const isPending = loading || localizedTitles.isPending
  if (!isPending && !items?.length) return null

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t('title.moreFromFranchise')}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {isPending ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton className="aspect-2/3 w-36 shrink-0 rounded-md" key={item} />
            ))}
          </div>
        ) : (
          <MediaRow aria-label={t('title.moreFromFranchise')}>
            {localizedItems(items, localizedTitles, t('diary.unknownTitle')).map((item) => (
              <MediaCard item={item} key={`${item.media_type}-${item.id}`} />
            ))}
          </MediaRow>
        )}
      </CardContent>
    </Card>
  )
}

export function TrailerCard({
  error,
  loading,
  title,
  trailer,
}: {
  error?: boolean
  loading: boolean
  title: string
  trailer?: TMDbVideo | null
}) {
  const { t } = useTranslation()

  if (loading) {
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

function DialogTriggerThumbnail({ label, trailer }: { label: string; trailer: TMDbVideo }) {
  return (
    <DialogTrigger
      aria-label={label}
      className="focus-ring group relative aspect-video w-full overflow-hidden rounded-md bg-black"
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
  error,
  loading,
  media,
  providers,
}: {
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

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t('title.whereToWatch')}</CardTitle>
        {providers?.region ? (
          <p className="text-xs text-kino-muted">
            {t('title.availableIn', { region: regionName(providers.region) })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {hasProviders ? (
          PROVIDER_CATEGORIES.map((category) => {
            const items = providers?.groups[category]
            if (!items?.length) return null
            return (
              <section className="grid gap-2" key={category}>
                <h3 className="text-xs font-semibold text-kino-subtle">
                  {t(`title.providerCategories.${category}`)}
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,96px)] gap-3">
                  {items.map((provider) => (
                    <WatchProviderServiceCard
                      key={`${category}-${provider.provider_id}`}
                      media={media}
                      provider={provider}
                      region={providers?.region || 'US'}
                    />
                  ))}
                </div>
              </section>
            )
          })
        ) : (
          <p className="text-sm leading-6 text-kino-muted">
            {error ? t('title.providersUnavailable') : t('title.noProviders')}
          </p>
        )}
        {providers?.link && hasProviders ? (
          <a
            aria-label={t('title.viewWatchOptions')}
            className={cn(buttonVariants({ size: 'sm', variant: 'secondary' }), 'w-full')}
            href={providers.link}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('title.viewWatchOptions')}
            <ExternalLink aria-hidden="true" data-icon="inline-end" />
          </a>
        ) : null}
        <p className="text-xs leading-5 text-kino-subtle">{t('title.justWatchAttribution')}</p>
      </CardContent>
    </Card>
  )
}

function WatchProviderServiceCard({
  media,
  provider,
  region,
}: {
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
          ? t('title.searchForOn', { provider: provider.provider_name, title: media.title })
          : destination.kind === 'direct'
            ? t('title.watchOnProvider', {
                provider: provider.provider_name,
                title: media.title,
              })
            : t('title.openProvider', { provider: provider.provider_name })
      }
      brandColor={getProviderBrandColor(provider.provider_name)}
      href={destination.webUrl}
      iconUrl={getTMDbImageUrl(provider.logo_path, 'w200') || undefined}
      label={provider.provider_name}
    />
  )
}

export function MoreLikeThis({
  error,
  items,
  loading,
}: {
  error?: boolean
  items?: TMDbTitle[]
  loading: boolean
}) {
  const { t } = useTranslation()
  const localizedTitles = useLocalizedTitles(localizationRequests(items))
  const isPending = loading || localizedTitles.isPending
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t('title.moreLikeThis')}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {isPending ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton className="aspect-2/3 w-36 shrink-0 rounded-md" key={item} />
            ))}
          </div>
        ) : items?.length ? (
          <MediaRow aria-label={t('title.moreLikeThis')}>
            {localizedItems(items, localizedTitles, t('diary.unknownTitle')).map((item) => (
              <MediaCard item={item} key={`${item.media_type}-${item.id}`} />
            ))}
          </MediaRow>
        ) : (
          <p className="text-sm leading-6 text-kino-muted">
            {error ? t('title.recommendationsUnavailable') : t('title.noRecommendations')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function localizationRequests(items?: TMDbTitle[]) {
  return (items || []).map((item) => ({
    tmdbId: item.id,
    type: item.media_type === 'tv' ? ('tv' as const) : ('movie' as const),
  }))
}

function localizedItems(
  items: TMDbTitle[] | undefined,
  localized: ReturnType<typeof useLocalizedTitles>,
  unknownTitle: string
) {
  return (items || []).map((item) => {
    const type = item.media_type === 'tv' ? 'tv' : 'movie'
    const value = resolveLocalizedTitlePresentation({
      ...localized,
      request: { tmdbId: item.id, type },
      unknownTitle,
    })
    return {
      ...item,
      backdrop_path: value.backdropPath,
      name: type === 'tv' ? value.title : item.name,
      poster_path: value.posterPath,
      title: type === 'movie' ? value.title : item.title,
    }
  })
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
