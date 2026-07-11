'use client'

import { BookmarkPlus, CalendarDays, CheckCircle2, ListChecks, Play, Star, UsersRound } from 'lucide-react'
import { type ReactNode } from 'react'
import { AccentDots } from '@/components/landing/accent-dots'
import { LandingReveal } from '@/components/landing/landing-reveal'
import { useTranslation } from '@/lib/i18n'

export function PersonalDiarySection() {
  const { t } = useTranslation()

  return (
    <ShowcaseSection
      body={t('landing.features.diary.body')}
      title={t('landing.features.diary.headline')}
      visual={<DiaryMockup />}
    />
  )
}

export function CommunityRatingsSection() {
  const { t } = useTranslation()

  return (
    <ShowcaseSection
      body={t('landing.community.body')}
      reverse
      title={t('landing.community.headline')}
      visual={<RatingsMockup />}
    />
  )
}

export function WatchlistsSection() {
  const { t } = useTranslation()

  return (
    <ShowcaseSection
      body={t('landing.features.watchlists.body')}
      title={t('landing.features.watchlists.headline')}
      visual={<WatchlistMockup />}
    />
  )
}

export function ProgressTrackingSection() {
  const { t } = useTranslation()

  return (
    <ShowcaseSection
      body={t('landing.features.progress.body')}
      reverse
      title={t('landing.features.progress.headline')}
      visual={<ProgressMockup />}
    />
  )
}

function ShowcaseSection({
  title,
  body,
  visual,
  reverse = false,
}: {
  title: string
  body: string
  visual: ReactNode
  reverse?: boolean
}) {
  return (
    <section className="landing-section py-16 sm:py-20">
      <LandingReveal
        className={
          reverse
            ? 'feature-row reverse'
            : 'feature-row'
        }
      >
        <div>{visual}</div>
        <div className="max-w-xl">
          <h2 className="text-3xl font-black italic leading-tight tracking-normal text-kino-text sm:text-5xl">
            <AccentDots>{title}</AccentDots>
          </h2>
          <p className="mt-5 text-base leading-8 text-kino-muted">{body}</p>
        </div>
      </LandingReveal>
    </section>
  )
}

function DiaryMockup() {
  const rows = [
    { day: '18', title: 'Past Lives', note: 'First time', rating: '4.5' },
    { day: '17', title: 'The Bear', note: 'S2E6', rating: '5.0' },
    { day: '15', title: 'Arrival', note: 'Rewatch', rating: '4.5' },
  ]

  return (
    <div className="rounded-md border border-white/10 bg-kino-panel p-4 md:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-kino-text">March diary</p>
          <p className="mt-1 text-xs text-kino-muted">Localized dates, ratings, and notes</p>
        </div>
        <CalendarDays className="text-kino-accent" size={20} />
      </div>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div className="grid grid-cols-[44px_40px_1fr_auto] items-center gap-3 rounded-md bg-white/[0.035] p-3" key={row.title}>
            <span className="text-center text-2xl font-light text-kino-muted">{row.day}</span>
            <span className="aspect-[2/3] rounded-md bg-[linear-gradient(145deg,rgb(255_255_255_/_0.2),rgb(29_185_84_/_0.18))]" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-kino-text">{row.title}</span>
              <span className="mt-1 block text-xs text-kino-muted">{row.note}</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-kino-accent">
              <Star fill="currentColor" size={12} />
              {row.rating}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RatingsMockup() {
  return (
    <div className="rounded-md border border-white/10 bg-kino-panel p-4 md:p-5">
      <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md bg-black/20 p-4">
          <div className="text-sm font-bold text-kino-text">Community score</div>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-5xl font-black text-kino-text">4.3</span>
            <span className="pb-2 text-sm font-semibold text-kino-muted">/ 5</span>
          </div>
          <div className="mt-5 grid gap-2">
            {[84, 68, 44, 20, 10].map((width, index) => (
              <div className="grid grid-cols-[18px_1fr] items-center gap-2" key={width}>
                <span className="text-xs text-kino-muted">{5 - index}</span>
                <span className="h-2 rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-kino-accent" style={{ width: `${width}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          {['Maya', 'Caio', 'Noah'].map((name, index) => (
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.035] p-3" key={name}>
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-kino-accent/15 text-xs font-bold text-kino-accent">
                  {name.slice(0, 1)}
                </span>
                <span>
                  <span className="block text-sm font-bold text-kino-text">{name}</span>
                  <span className="text-xs text-kino-muted">{index === 0 ? 'Watched last night' : 'Added a note'}</span>
                </span>
              </div>
              <span className="flex items-center gap-1 text-sm font-bold text-kino-accent">
                <Star fill="currentColor" size={13} />
                {index === 2 ? '4.0' : '4.5'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WatchlistMockup() {
  return (
    <div className="rounded-md border border-white/10 bg-kino-panel p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-kino-text">Weekend queue</p>
          <p className="mt-1 text-xs text-kino-muted">Private or shared with a code</p>
        </div>
        <span className="rounded-md bg-kino-accent/15 px-3 py-1.5 text-xs font-bold text-kino-accent">A7K9Q2</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div className="grid gap-2" key={item}>
            <div className="aspect-[2/3] rounded-md bg-[linear-gradient(145deg,rgb(255_255_255_/_0.18),rgb(0_0_0_/_0.22))]" />
            <div className="h-2 rounded-full bg-white/14" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-kino-muted">
          <UsersRound size={14} />
          4 collaborators
        </span>
        <span className="inline-flex items-center gap-2 rounded-md bg-kino-accent px-3 py-2 text-xs font-bold text-black">
          <BookmarkPlus size={14} />
          Add title
        </span>
      </div>
    </div>
  )
}

function ProgressMockup() {
  const episodes = [
    { label: 'S1E6', progress: 100, watched: true },
    { label: 'S1E7', progress: 100, watched: true },
    { label: 'S1E8', progress: 32, watched: false },
  ]

  return (
    <div className="rounded-md border border-white/10 bg-kino-panel p-4 md:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-kino-text">Season progress</p>
          <p className="mt-1 text-xs text-kino-muted">Episodes and season completion stay in sync.</p>
        </div>
        <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-kino-muted">7 / 10</span>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[70%] rounded-full bg-kino-accent" />
      </div>
      <div className="grid gap-3">
        {episodes.map((episode) => (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md bg-white/[0.035] p-3" key={episode.label}>
            <span className="grid size-8 place-items-center rounded-md bg-black/20 text-xs font-bold text-kino-muted">
              {episode.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-kino-accent" style={{ width: `${episode.progress}%` }} />
            </span>
            {episode.watched ? (
              <CheckCircle2 className="text-kino-accent" size={19} />
            ) : (
              <Play className="text-kino-muted" size={19} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
