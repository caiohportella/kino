'use client'

import Link from 'next/link'
import { FooterSocialLinks } from '@/components/footer-social-links'
import { useTranslation } from '@/lib/i18n'

export function AppFooter() {
  const currentYear = new Date().getFullYear()
  const { t } = useTranslation()

  return (
    <footer className="border-t border-white/[0.06] py-5">
      <div className="content-frame flex flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="grid gap-1">
          <Link
            className="w-fit text-lg font-black italic tracking-normal text-kino-text"
            href="/discover"
          >
            Kino<span className="text-kino-accent">.</span>
          </Link>
          <p className="text-xs text-kino-muted">
            {t('appFooter.copyright', { year: currentYear })}
          </p>
        </div>

        <p className="text-xs text-kino-muted sm:text-center">
          {t('appFooter.metadataProvidedBy')}{' '}
          <a
            className="font-semibold text-kino-text hover:underline"
            href="https://www.themoviedb.org/"
            rel="noreferrer"
            target="_blank"
          >
            TMDB
          </a>
          .
        </p>

        <FooterSocialLinks navigationLabel={t('appFooter.socialLinks')} />
      </div>
    </footer>
  )
}
