'use client'

import {
  ArrowRight,
  BookmarkPlus,
  CalendarCheck,
  Clapperboard,
  Compass,
  Film,
  ListChecks,
  Play,
  Search,
  Star,
  UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import type { RefObject } from 'react'
import { AccentDots } from '@/components/landing/accent-dots'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

const featureCards = [
  {
    icon: Film,
    title: 'Track movies and series',
    body: 'Keep every watch, rating, and season in one calm library.',
  },
  {
    icon: Clapperboard,
    title: 'Keep a personal diary',
    body: 'Build a timeline of what you watched and when it mattered.',
  },
  {
    icon: ListChecks,
    title: 'Create shared watchlists',
    body: 'Plan what to watch next alone or with friends.',
  },
  {
    icon: UsersRound,
    title: 'Follow familiar taste',
    body: 'See ratings and discoveries from people you trust.',
  },
] as const

export function LandingHero({ logoRef }: { logoRef?: RefObject<HTMLSpanElement | null> }) {
  const { t } = useTranslation()

  return (
    <section className="relative border-b border-white/[0.06] bg-kino-bg pt-24">
      <div className="landing-section grid min-h-[calc(100svh-104px)] items-center gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_480px] lg:pb-20">
        <div className="flex flex-col gap-9 py-8">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
              <img alt="" className="size-8" src="/icons/icon-192.png" />
            </span>
            <span ref={logoRef} className="text-2xl font-black italic tracking-normal text-kino-text">
              <AccentDots>Kino.</AccentDots>
            </span>
          </div>

          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-kino-accent">
              {t('landing.hero.eyebrow')}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black italic leading-[0.96] tracking-normal text-kino-text sm:text-6xl lg:text-7xl">
              <AccentDots>{t('landing.hero.headline')}</AccentDots>
            </h1>
            <p className="mt-12 max-w-2xl text-base leading-8 text-kino-muted sm:text-lg">
              {t('landing.hero.body')}
            </p>
          </div>

          <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
            {featureCards.map((feature) => {
              const Icon = feature.icon
              return (
                <div className="rounded-md border border-white/10 bg-white/[0.035] p-4" key={feature.title}>
                  <div className="mb-4 grid size-9 place-items-center rounded-md bg-kino-accent/15 text-kino-accent">
                    <Icon size={18} />
                  </div>
                  <h2 className="text-sm font-bold text-kino-text">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-kino-muted">{feature.body}</p>
                </div>
              )
            })}
          </div>
        </div>

        <HeroProductPreview />
      </div>
    </section>
  )
}

function HeroProductPreview() {
  return (
    <div aria-label="Kino product preview" className="relative hidden lg:block">
      <div className="rounded-md border border-white/[0.12] bg-kino-surface p-4 shadow-[0_24px_80px_rgb(0_0_0_/_0.34)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-yellow-300/80" />
            <span className="size-2.5 rounded-full bg-kino-accent/90" />
          </div>
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-kino-muted">Tonight</span>
        </div>

        <div className="grid gap-4">
          <div className="overflow-hidden rounded-md border border-white/10 bg-black/25">
            <div className="h-40 bg-[linear-gradient(135deg,rgb(29_185_84_/_0.22),rgb(255_255_255_/_0.08)_42%,rgb(0_0_0_/_0.24))]" />
            <div className="grid gap-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="h-3 w-44 rounded-full bg-white/25" />
                  <div className="mt-3 h-2 w-28 rounded-full bg-white/12" />
                </div>
                <div className="rounded-md bg-kino-accent px-3 py-1 text-xs font-black text-black">4.5</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PreviewAction icon={BookmarkPlus} label="Watchlist" active />
                <PreviewAction icon={CalendarCheck} label="Diary" />
                <PreviewAction icon={Play} label="Trailer" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_0.72fr]">
            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold text-kino-subtle">Diary</span>
                <span className="text-xs font-bold text-kino-accent">Synced</span>
              </div>
              <div className="grid gap-3">
                {['Dune: Part Two', 'Shogun', 'Past Lives'].map((title, index) => (
                  <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3" key={title}>
                    <span className="text-sm font-light text-kino-muted">{18 - index}</span>
                    <span className="truncate text-sm font-semibold text-kino-text">{title}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-kino-accent">
                      <Star fill="currentColor" size={12} />
                      {index === 1 ? '4.0' : '4.5'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold text-kino-subtle">
                <Search size={14} />
                Fast search
              </div>
              <div className="grid gap-2">
                <div className="h-2 rounded-full bg-white/20" />
                <div className="h-2 w-4/5 rounded-full bg-white/12" />
                <div className="mt-3 h-20 rounded-md border border-white/10 bg-white/[0.045]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewAction({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof BookmarkPlus
  label: string
  active?: boolean
}) {
  return (
    <span
      className={
        active
          ? 'inline-flex items-center gap-2 rounded-md bg-kino-accent px-3 py-2 text-xs font-bold text-black'
          : 'inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-kino-muted'
      }
    >
      <Icon size={14} />
      {label}
    </span>
  )
}
