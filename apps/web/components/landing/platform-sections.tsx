'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Globe2, Languages, Laptop, Smartphone } from 'lucide-react'
import { AccentDots } from '@/components/landing/accent-dots'
import { LandingReveal } from '@/components/landing/landing-reveal'
import { supportedLanguages, useTranslation } from '@/lib/i18n'

export function CrossPlatformSection() {
  const { t } = useTranslation()

  return (
    <section className="landing-section py-16 sm:py-20">
      <LandingReveal className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="max-w-xl">
          <div className="mb-5 grid size-12 place-items-center rounded-md bg-kino-accent/15 text-kino-accent">
            <Laptop size={24} />
          </div>
          <h2 className="text-3xl font-black italic leading-tight tracking-normal text-kino-text sm:text-5xl">
            <AccentDots>{t('landing.platforms.headline')}</AccentDots>
          </h2>
          <p className="mt-5 text-base leading-8 text-kino-muted">{t('landing.platforms.body')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_0.72fr] sm:items-end">
          <div className="rounded-md border border-white/10 bg-kino-panel p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-kino-muted">
              <Laptop size={16} />
              {t('landing.platforms.webLabel')}
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="h-3 w-44 rounded-full bg-white/20" />
              <div className="mt-5 grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((item) => (
                  <span className="aspect-[2/3] rounded-md bg-white/[0.07]" key={item} />
                ))}
              </div>
              <div className="mt-5 h-20 rounded-md bg-white/[0.04]" />
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-kino-panel p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-kino-muted">
              <Smartphone size={16} />
              {t('landing.platforms.mobileLabel')}
            </div>
            <div className="mx-auto max-w-[190px] rounded-md border border-white/10 bg-black/30 p-3">
              <div className="h-2 w-16 rounded-full bg-white/20" />
              <div className="mt-4 aspect-[2/3] rounded-md bg-[linear-gradient(145deg,rgb(29_185_84_/_0.2),rgb(255_255_255_/_0.08))]" />
              <div className="mt-4 grid gap-2">
                <span className="h-2 rounded-full bg-white/20" />
                <span className="h-2 w-3/4 rounded-full bg-white/12" />
              </div>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  )
}

export function InternationalizationSection() {
  const { i18n, t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
  })

  return (
    <section className="landing-section py-16 sm:py-20">
      <LandingReveal className="rounded-md border border-white/10 bg-kino-panel p-5 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <div className="mb-5 grid size-12 place-items-center rounded-md bg-kino-accent/15 text-kino-accent">
              <Languages size={24} />
            </div>
            <h2 className="text-3xl font-black italic leading-tight tracking-normal text-kino-text sm:text-5xl">
              <AccentDots>{t('landing.i18n.headline')}</AccentDots>
            </h2>
            <p className="mt-5 text-base leading-8 text-kino-muted">{t('landing.i18n.body')}</p>
          </div>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('settings.language')}>
              {supportedLanguages.map((language) => (
                <motion.button
                  aria-pressed={language === i18n.language}
                  className={
                    language === i18n.language
                      ? 'rounded-md bg-kino-accent px-3 py-2 text-sm font-bold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent'
                      : 'rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-kino-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent'
                  }
                  key={language}
                  onClick={() => {
                    void i18n.changeLanguage(language)
                  }}
                  type="button"
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  {t(`landing.i18n.languages.${language}`)}
                </motion.button>
              ))}
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-kino-muted">
                <Globe2 size={16} />
                {t('landing.i18n.exampleLabel')}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 text-2xl font-bold text-kino-text"
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  key={i18n.language}
                  transition={{ duration: reduceMotion ? 0 : 0.24 }}
                >
                  {dateFormatter.format(new Date(2026, 2, 18))}
                </motion.p>
              </AnimatePresence>
              <p className="mt-2 text-sm leading-6 text-kino-muted">
                {t('landing.i18n.exampleBody')}
              </p>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  )
}
