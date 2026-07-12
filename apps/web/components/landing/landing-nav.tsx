'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { KinoLogo } from '@/components/kino-logo'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LandingNav({ showBrand }: { showBrand: boolean }) {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.nav
      aria-label="Site navigation"
      animate={{
        backgroundColor: scrolled ? 'rgba(10, 10, 10, 0.88)' : 'rgba(10, 10, 10, 0)',
        borderColor: scrolled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0)',
      }}
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b backdrop-blur-[20px]',
        scrolled ? 'backdrop-blur-[20px]' : 'backdrop-blur-none'
      )}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="landing-section flex min-h-[68px] items-center justify-between gap-6">
        <motion.div
          animate={{ opacity: showBrand ? 1 : 0, y: showBrand ? 0 : -4 }}
          className={showBrand ? '' : 'pointer-events-none'}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            aria-hidden={!showBrand}
            className="block hover:opacity-80"
            tabIndex={showBrand ? 0 : -1}
            href="/"
          >
            <KinoLogo priority width={92} />
          </Link>
        </motion.div>

        <div className="flex items-center gap-2">
          <Button
            className="hidden md:inline-flex"
            nativeButton={false}
            render={<Link href="/discover" />}
            size="sm"
            variant="ghost"
          >
            {t('landing.nav.explore')}
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/auth/login" />}
            size="sm"
            variant="ghost"
          >
            {t('landing.nav.signIn')}
          </Button>
          <Button
            nativeButton={false}
            className="text-black font-bold"
            render={<Link href="/auth/register" />}
            size="sm"
          >
            {t('landing.nav.createAccount')}
          </Button>
        </div>
      </div>
    </motion.nav>
  )
}
