'use client'

import type { TMDbPerson, TMDbPersonCredit } from '@kino/core'
import { formatDate, getDisplayTitle, getKnownForCredits, getReleaseYear } from '@kino/core'
import { EmptyState, Poster } from '@kino/ui'
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  Cross,
  Globe2,
  House,
  Landmark,
  Star,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ExternalLinksSection,
  type ExternalLinkProvider,
} from '@/components/external-links-section'
import { PersonSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { getPersonImagePaths } from '@/lib/person-visuals'
import { parseResourceSegment, personPath, titlePath } from '@/lib/routes'

export default function PersonPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const personId = parseResourceSegment(params.id).id
  const language = useSettingsStore((state) => state.language)
  const validPersonId = Number.isFinite(personId) && personId > 0

  const personQuery = useQuery({
    queryKey: ['person-details', personId, language],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      return tmdb.getPersonDetails(personId)
    },
    enabled: validPersonId,
  })

  const knownFor = useMemo(
    () => getKnownForCredits(personQuery.data?.combined_credits, 24),
    [personQuery.data?.combined_credits]
  )

  if (!validPersonId) {
    return (
      <div className="content-frame">
        <EmptyState
          body="This person link is missing a valid TMDB identifier."
          title="Person not found"
        />
      </div>
    )
  }

  if (personQuery.isLoading) return <PersonSkeleton label="Loading person..." />

  if (personQuery.error || !personQuery.data) {
    return (
      <div className="content-frame">
        <EmptyState body="Kino could not load this person from TMDB." title="Person not found" />
      </div>
    )
  }

  const person = personQuery.data
  const tmdb = getTmdb()
  const visualPaths = getPersonImagePaths(person)
  const profile = tmdb.getImageUrl(visualPaths.portraitPath, 'w300')
  const backdrop = tmdb.getBackdropUrl(visualPaths.bannerPath, 'w1280')

  return (
    <div className="content-frame">
      <div className="mb-5">
        <Button onClick={() => router.back()} variant="ghost">
          <ArrowLeft size={16} />
          Back
        </Button>
      </div>

      <section className="relative mb-8 min-h-[420px] overflow-hidden rounded-md border border-white/10 bg-kino-surface">
        <div className="absolute inset-0">
          {backdrop ? (
            <img alt="" className="h-full w-full object-cover" src={backdrop} />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgb(29_185_84_/_0.12),rgb(255_255_255_/_0.04)_44%,rgb(0_0_0_/_0.18))]" />
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-kino-surface via-kino-surface/75 to-black/20" />

        <div className="relative z-10 grid min-h-[420px] content-end gap-5 p-5 md:grid-cols-[160px_1fr] md:items-end md:p-6">
          <div className="aspect-[2/3] w-32 overflow-hidden rounded-md border border-white/10 bg-white/[0.06] shadow-[0_18px_42px_rgb(0_0_0_/_0.35)] md:w-full">
            {profile ? (
              <img alt={person.name} className="h-full w-full object-cover" src={profile} />
            ) : (
              <div className="grid h-full place-items-center text-kino-muted">
                <UserRound size={42} />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="max-w-4xl text-3xl font-semibold text-kino-text md:text-5xl">
              {person.name}
            </h1>
            {person.known_for_department ? (
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-kino-muted">
                <BriefcaseBusiness aria-hidden="true" size={15} />
                <span>{person.known_for_department}</span>
              </div>
            ) : null}
            <div className="mt-4 max-w-3xl text-sm font-semibold text-kino-text">
              <LifeMetadata person={person} />
            </div>
          </div>
        </div>
      </section>

      <main className="grid gap-8">
        <Biography biography={person.biography} />

        <PersonExternalLinks person={person} />

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-kino-text">Known for</h2>
            </div>
          </div>

          {knownFor.length > 0 ? (
            <div className="poster-grid">
              {knownFor.map((credit) => (
                <PersonCreditCard credit={credit} key={`${credit.media_type}-${credit.id}`} />
              ))}
            </div>
          ) : (
            <EmptyState
              body="TMDB does not list movie or series credits for this person yet."
              className="mx-0"
              title="No credits available"
            />
          )}
        </section>
      </main>
    </div>
  )
}

function PersonCreditCard({ credit }: { credit: TMDbPersonCredit }) {
  const tmdb = getTmdb()
  const title = getDisplayTitle(credit)
  const type = credit.media_type === 'tv' ? 'tv' : 'movie'
  const year = getReleaseYear(credit)
  const poster = tmdb.getImageUrl(credit.poster_path, 'w300')
  const role = credit.character || credit.job

  return (
    <Link className="group grid min-w-0 gap-3 focus-ring" href={titlePath(credit.id, title, type)}>
      <Poster className="w-full rounded-md" src={poster} title={title} />
      <div className="min-w-0">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-kino-text group-hover:text-kino-accent">
          {title}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-kino-muted">
          <span className="min-w-0 truncate">
            {year || 'TBA'} - {type === 'tv' ? 'Series' : 'Movie'}
          </span>
          <span>{credit.vote_average ? credit.vote_average.toFixed(1) : 'New'}</span>
        </div>
        {role ? <p className="mt-1 truncate text-xs text-kino-subtle">{role}</p> : null}
      </div>
    </Link>
  )
}

function LifeMetadata({ person }: { person: TMDbPerson }) {
  const age = person.birthday ? getAge(person.birthday, person.deathday) : null
  const hasDateMetadata = Boolean(person.birthday || person.deathday)
  const hasLocationMetadata = Boolean(person.place_of_birth || person.place_of_death)

  return (
    <div className="grid gap-2">
      {hasDateMetadata ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {person.birthday ? (
            <Star aria-hidden="true" className="shrink-0 text-kino-accent" size={16} />
          ) : (
            <Cross aria-hidden="true" className="shrink-0 text-kino-muted" size={16} />
          )}
          {person.birthday ? <span>{formatDate(person.birthday)}</span> : null}
          {person.deathday ? (
            <>
              {person.birthday ? <span className="text-kino-subtle">•</span> : null}
              <span>{formatDate(person.deathday)}</span>
            </>
          ) : null}
          {age !== null ? <span className="text-kino-muted">(age {age})</span> : null}
        </div>
      ) : null}

      {hasLocationMetadata ? (
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-kino-muted">
          {person.place_of_birth ? (
            <>
              <House aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
              <span>{person.place_of_birth}</span>
            </>
          ) : null}
          {person.place_of_death ? (
            <>
              {person.place_of_birth ? <span className="text-kino-subtle">•</span> : null}
              <Landmark aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
              <span>{person.place_of_death}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function getAge(birthday: string, deathday: string | null) {
  const start = new Date(`${birthday}T00:00:00`)
  const end = deathday ? new Date(`${deathday}T00:00:00`) : new Date()
  let age = end.getFullYear() - start.getFullYear()
  const birthdayHasPassed =
    end.getMonth() > start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() >= start.getDate())
  if (!birthdayHasPassed) age -= 1
  return Math.max(0, age)
}

const COLLAPSED_BIOGRAPHY_HEIGHT = 168

function Biography({ biography }: { biography: string }) {
  const contentRef = useRef<HTMLParagraphElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const [hasOverflow, setHasOverflow] = useState(false)
  const content = biography || 'No biography is available for this person yet.'

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return

    const measure = () => {
      const nextHeight = element.scrollHeight
      setContentHeight(nextHeight)
      setHasOverflow(nextHeight > COLLAPSED_BIOGRAPHY_HEIGHT + 1)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <Card className="p-5 md:p-6">
      <h2 className="mb-3 text-xl font-semibold text-kino-text">Biography</h2>
      <div className="relative">
        <p
          className="w-full overflow-hidden text-base leading-7 text-kino-text transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
          id="person-biography"
          ref={contentRef}
          style={{
            maxHeight: hasOverflow
              ? expanded
                ? contentHeight
                : COLLAPSED_BIOGRAPHY_HEIGHT
              : undefined,
          }}
        >
          {content}
        </p>
        {hasOverflow && !expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-kino-surface to-transparent" />
        ) : null}
      </div>
      {hasOverflow ? (
        <Button
          aria-controls="person-biography"
          aria-expanded={expanded}
          className="mt-2 px-0 text-kino-muted hover:text-kino-text hover:bg-transparent"
          onClick={() => setExpanded((current) => !current)}
          variant="ghost"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'transition-transform duration-200 motion-reduce:transition-none',
              expanded && 'rotate-180'
            )}
            size={16}
          />
        </Button>
      ) : null}
    </Card>
  )
}

function PersonExternalLinks({ person }: { person: TMDbPerson }) {
  const links: Array<ExternalLinkProvider | null> = [
    {
      label: 'TMDB',
      href: `https://www.themoviedb.org/person/${person.id}`,
      iconUrl:
        'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
      brandColor: '#01b4e4',
    },
    person.external_ids?.imdb_id
      ? {
          label: 'IMDb',
          href: `https://www.imdb.com/name/${person.external_ids.imdb_id}`,
          iconUrl: '/external/imdb.png',
          brandColor: '#f5c518',
        }
      : null,
    person.external_ids?.instagram_id
      ? {
          label: 'Instagram',
          href: `https://instagram.com/${person.external_ids.instagram_id}`,
          iconUrl: 'https://cdn.simpleicons.org/instagram/E4405F',
          brandColor: '#e4405f',
        }
      : null,
    person.external_ids?.twitter_id
      ? {
          label: 'X',
          href: `https://x.com/${person.external_ids.twitter_id}`,
          iconUrl: 'https://cdn.simpleicons.org/x/FFFFFF',
          brandColor: '#ffffff',
        }
      : null,
    person.external_ids?.facebook_id
      ? {
          label: 'Facebook',
          href: `https://facebook.com/${person.external_ids.facebook_id}`,
          iconUrl: 'https://cdn.simpleicons.org/facebook/0866FF',
          brandColor: '#0866ff',
        }
      : null,
    person.external_ids?.tiktok_id
      ? {
          label: 'TikTok',
          href: `https://tiktok.com/@${person.external_ids.tiktok_id}`,
          iconUrl: 'https://cdn.simpleicons.org/tiktok/FFFFFF',
          brandColor: '#ffffff',
        }
      : null,
    person.external_ids?.youtube_id
      ? {
          label: 'YouTube',
          href: `https://youtube.com/channel/${person.external_ids.youtube_id}`,
          iconUrl: 'https://cdn.simpleicons.org/youtube/FF0000',
          brandColor: '#ff0000',
        }
      : null,
    person.external_ids?.wikidata_id
      ? {
          label: 'Wikidata',
          href: `https://www.wikidata.org/wiki/${person.external_ids.wikidata_id}`,
          iconUrl: 'https://cdn.simpleicons.org/wikidata/339966',
          brandColor: '#339966',
        }
      : null,
    person.homepage
      ? {
          label: 'Official site',
          href: person.homepage,
          icon: <Globe2 aria-hidden="true" size={30} />,
          brandColor: '#1db954',
        }
      : null,
  ]
  return <ExternalLinksSection compact providers={links} />
}
