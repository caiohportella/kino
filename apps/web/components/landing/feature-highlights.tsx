'use client'

import { BarChart3, Download, Search, Sparkles, Star, Wand2 } from 'lucide-react'
import { AccentDots } from '@/components/landing/accent-dots'
import { LandingReveal } from '@/components/landing/landing-reveal'
import { useTranslation } from '@/lib/i18n'

const highlightCards = [
  {
    icon: Search,
    title: 'Browse before you commit',
    body: 'Movies, series, people, seasons, episodes, collections, providers, trailers, and external links stay open to everyone.',
  },
  {
    icon: Star,
    title: 'Personal data only when it matters',
    body: 'Ratings, diary entries, episode progress, watched state, follows, and watchlist edits ask for an account at the point of action.',
  },
  {
    icon: BarChart3,
    title: 'Taste becomes visible over time',
    body: 'Stats and recommendations grow from the library you choose to save, not from a forced onboarding wall.',
  },
] as const

export function FeatureHighlights() {
  const { t } = useTranslation()

  return (
    <section className="landing-section py-20 sm:py-24">
      <LandingReveal className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-kino-accent">{t('landing.features.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-black italic leading-tight tracking-normal text-kino-text sm:text-5xl">
            <AccentDots>{t('landing.features.headline')}</AccentDots>
          </h2>
          <p className="mt-5 text-base leading-8 text-kino-muted">
            Kino opens the catalog first and saves the account request for moments that create a
            personal library. The result is a calmer first visit and a clearer reason to sign in.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1.08fr_0.92fr]">
            <HighlightCard {...highlightCards[0]} featured />
            <HighlightCard {...highlightCards[1]} />
          </div>
          <div className="grid gap-3 md:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-md border border-white/10 bg-kino-panel p-5">
              <div className="flex items-center gap-3 text-kino-accent">
                <Download size={18} />
                <span className="text-sm font-bold">Progressive Web App</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-kino-muted">
                Install Kino from the browser, keep the same visual language on mobile, and pick up
                where you left off.
              </p>
            </div>
            <HighlightCard {...highlightCards[2]} />
          </div>
        </div>
      </LandingReveal>

      <LandingReveal className="mt-16 rounded-md border border-white/10 bg-kino-panel p-5 md:p-6">
        <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="grid size-12 place-items-center rounded-md bg-kino-accent/15 text-kino-accent">
            <Wand2 size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-kino-text">
              <AccentDots>A complete public pass through Kino.</AccentDots>
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-kino-muted">
              Anonymous visitors can search, inspect cast and crew, check providers, watch trailers,
              and move through public pages without being interrupted.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-kino-muted">
            <Sparkles size={16} />
            Account prompts stay contextual
          </div>
        </div>
      </LandingReveal>
    </section>
  )
}

function HighlightCard({
  icon: Icon,
  title,
  body,
  featured = false,
}: {
  icon: typeof Search
  title: string
  body: string
  featured?: boolean
}) {
  return (
    <article
      className={
        featured
          ? 'rounded-md border border-kino-accent/30 bg-kino-accent/10 p-5'
          : 'rounded-md border border-white/10 bg-white/[0.035] p-5'
      }
    >
      <div className="grid size-10 place-items-center rounded-md bg-black/20 text-kino-accent">
        <Icon size={19} />
      </div>
      <h3 className="mt-5 text-lg font-bold text-kino-text">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-kino-muted">{body}</p>
    </article>
  )
}
