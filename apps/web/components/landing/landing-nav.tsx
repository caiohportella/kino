'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AccentDots } from '@/components/landing/accent-dots'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

export function LandingNav({ showBrand }: { showBrand: boolean }) {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      aria-label="Site navigation"
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.08] bg-kino-bg/88 backdrop-blur-[20px]'
          : 'bg-transparent'
      )}
    >
      <div className="landing-section flex min-h-[68px] items-center justify-between gap-6">
        <Link
          aria-hidden={!showBrand}
          className={cn(
            'text-xl font-black italic tracking-normal text-kino-text transition-all duration-300 hover:opacity-80',
            showBrand ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-1'
          )}
          tabIndex={showBrand ? 0 : -1}
          href="/"
        >
          <AccentDots>Kino.</AccentDots>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden md:inline-flex" size="sm" variant="ghost">
            <Link href="/discover">{t('landing.nav.explore')}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/auth/login">{t('landing.nav.signIn')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/register">{t('landing.nav.createAccount')}</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
