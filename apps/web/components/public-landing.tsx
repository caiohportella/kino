'use client'

import { useEffect, useRef, useState } from 'react'
import { CrossPlatformSection, InternationalizationSection } from '@/components/landing/platform-sections'
import { FeatureHighlights } from '@/components/landing/feature-highlights'
import { LandingCTA } from '@/components/landing/landing-cta'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingNav } from '@/components/landing/landing-nav'
import {
  CommunityRatingsSection,
  PersonalDiarySection,
  ProgressTrackingSection,
  WatchlistsSection,
} from '@/components/landing/product-showcases'

export function PublicLanding() {
  const logoRef = useRef<HTMLSpanElement | null>(null)
  const [showBrand, setShowBrand] = useState(false)

  useEffect(() => {
    const logo = logoRef.current
    if (!logo) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setShowBrand(!entry.isIntersecting)
      },
      {
        threshold: 0,
      }
    )

    observer.observe(logo)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="min-h-screen overflow-hidden bg-kino-bg text-kino-text">
      <LandingNav showBrand={showBrand} />
      <LandingHero logoRef={logoRef} />
      <FeatureHighlights />
      <PersonalDiarySection />
      <CommunityRatingsSection />
      <WatchlistsSection />
      <ProgressTrackingSection />
      <CrossPlatformSection />
      <InternationalizationSection />
      <LandingCTA />
      <LandingFooter />
    </main>
  )
}
