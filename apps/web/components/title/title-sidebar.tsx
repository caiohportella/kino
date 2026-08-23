'use client'

import type { TitleDetails, TitleRatingStats, TMDbCast } from '@kino/core'
import { getTMDbImageUrl } from '@kino/core'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  type ExternalLinkProvider,
  ExternalLinksSection,
} from '@/components/external-links-section'
import {
  type TitleContextData,
  TrailerCard,
  WatchProvidersCard,
} from '@/components/title/title-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/localization/i18n'
import { personPath } from '@/lib/routes'

const EXTERNAL_LOGOS = {
  letterboxd: 'https://a.ltrbxd.com/logos/letterboxd-decal-dots-neg-rgb.svg',
  tmdb: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
  seriesGraph:
    'https://images.seriesgraph.com/fictional-posters/2e65671e-4c85-40a1-b184-44be9a8153a5-10ba660c-a406-42fc-aee1-74f87f822aca-1779031627029.jpg',
} as const

export function TitleSidebar({
  title,
  contextQuery,
  stats: _stats,
}: {
  title: TitleDetails
  contextQuery: {
    data: TitleContextData | undefined
    isLoading: boolean
    isError: boolean
  }
  stats: TitleRatingStats | undefined
}) {
  const hasCredits = Boolean(title.director || title.cast.length)

  return (
    <div className="title-sidebar w-full min-w-0 max-w-full">
      <Card className="overflow-hidden border-white/10 bg-white/2.5 p-0" size="sm">
        <TrailerCard
          embedded
          error={contextQuery.data?.errors.trailer || contextQuery.isError}
          loading={contextQuery.isLoading}
          title={title.title}
          trailer={contextQuery.data?.trailer}
        />

        <SidebarDivider />

        <SidebarSection>
          <WatchProvidersCard
            embedded
            error={contextQuery.data?.errors.providers || contextQuery.isError}
            loading={contextQuery.isLoading}
            media={{
              mediaType: title.type,
              releaseYear: title.year,
              title: title.title,
              tmdbId: title.tmdbId,
            }}
            providers={contextQuery.data?.providers}
          />
        </SidebarSection>

        <SidebarDivider />

        <SidebarSection>
          <ExternalLinksPanel title={title} />
        </SidebarSection>

        {hasCredits ? (
          <>
            <SidebarDivider />

            <SidebarSection className="pb-5">
              <CreditsPanel title={title} />
            </SidebarSection>
          </>
        ) : null}
      </Card>
    </div>
  )
}

function SidebarSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-5 xl:px-6 ${className}`}>{children}</div>
}

function SidebarDivider() {
  return <div aria-hidden="true" className="h-px bg-white/[0.07]" />
}

function SidebarHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-kino-text">{children}</h2>
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-kino-subtle">
      {children}
    </h3>
  )
}

function ExternalLinksPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()

  return (
    <ExternalLinksSection
      embedded
      providers={getTitleExternalLinks(title)}
      title={t('title.seeAlsoOn')}
    />
  )
}

function getTitleExternalLinks(title: TitleDetails): ExternalLinkProvider[] {
  const links: ExternalLinkProvider[] = []

  if (title.externalIds?.imdb_id) {
    links.push({
      href: `https://www.imdb.com/title/${title.externalIds.imdb_id}`,
      brandColor: '#f5c518',
      iconUrl: '/external/imdb.svg',
      label: 'IMDb',
    })
  }

  links.push({
    href: `https://www.themoviedb.org/${title.type === 'tv' ? 'tv' : 'movie'}/${title.tmdbId}`,
    brandColor: '#01b4e4',
    iconUrl: EXTERNAL_LOGOS.tmdb,
    label: 'TMDB',
  })

  if (title.type === 'movie') {
    links.push({
      href: `https://letterboxd.com/tmdb/${title.tmdbId}`,
      brandColor: '#00e054',
      iconUrl: EXTERNAL_LOGOS.letterboxd,
      label: 'Letterboxd',
    })
  }

  if (title.type === 'tv') {
    links.push({
      href: `https://seriesgraph.com/show/${title.tmdbId}`,
      brandColor: '#411052',
      iconUrl: EXTERNAL_LOGOS.seriesGraph,
      label: 'SeriesGraph',
    })
  }

  return links
}

function CreditsPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()

  const directorLabel = title.type === 'tv' ? t('title.creator') : t('title.director')

  const cast = title.cast.slice(0, 5)
  const hasMoreCast = title.cast.length > cast.length

  if (!title.director && cast.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4">
      <SidebarHeading>{t('title.credits')}</SidebarHeading>

      {title.director ? (
        <section className="grid gap-2">
          <SidebarLabel>{directorLabel}</SidebarLabel>

          <CreditPersonLink person={title.director} />
        </section>
      ) : null}

      {cast.length > 0 ? (
        <section className="grid gap-2">
          <SidebarLabel>{t('title.topCast')}</SidebarLabel>

          <div className="grid gap-0.5">
            {cast.map((person) => (
              <CreditPersonLink
                key={`${person.id}-${person.character || person.name}`}
                person={person}
                roleLabel={person.character}
              />
            ))}
          </div>

          {hasMoreCast ? <FullCastDialog title={title} /> : null}
        </section>
      ) : null}
    </div>
  )
}

function FullCastDialog({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            className="group mt-1 h-auto w-full justify-between px-1 py-2 text-sm font-medium text-kino-muted hover:bg-transparent hover:text-kino-text"
            size="sm"
            variant="ghost"
          >
            <span>{t('title.seeFullCast')}</span>

            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        }
      />

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title.fullCastFor', { title: title.title })}</DialogTitle>

          <DialogDescription>{t('title.fullCastDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
          {title.cast.map((person) => (
            <CreditPersonLink
              key={`${person.id}-${person.character || person.name}`}
              person={person}
              roleLabel={person.character}
              large
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreditPersonLink({
  person,
  roleLabel,
  large = false,
}: {
  person: TMDbCast
  roleLabel?: string
  large?: boolean
}) {
  const { t } = useTranslation()

  const avatar = getTMDbImageUrl(person.profile_path, 'w200')

  const initials = person.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link
      aria-label={t('title.viewPersonProfile', { name: person.name })}
      className="focus-ring group flex min-w-0 items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-white/4.5"
      href={personPath(person.id, person.name)}
    >
      <div
        className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-white/6 font-bold text-kino-muted ${
          large ? 'h-11 w-11 text-xs' : 'h-10 w-10 text-[11px]'
        }`}
      >
        {avatar ? (
          <img alt="" className="h-full w-full object-cover" loading="lazy" src={avatar} />
        ) : (
          initials
        )}
      </div>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-kino-text transition-colors group-hover:text-kino-accent xl:text-base">
          {person.name}
        </span>

        {roleLabel ? (
          <span className="mt-0.5 block truncate text-xs text-kino-muted xl:text-sm">
            {roleLabel}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
