import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/app-shell'

const DEFAULT_SITE_URL = 'https://kino.vercel.app'
const description = 'A calm movie and series tracking companion for discovery, watchlists, diary, and ratings.'

function normalizeOrigin(value: string | undefined) {
  if (!value) return DEFAULT_SITE_URL
  const origin = value.replace(/\/+$/, '')
  return origin.startsWith('http://') || origin.startsWith('https://') ? origin : `https://${origin}`
}

const siteOrigin = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.EXPO_PUBLIC_WEB_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL
)

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: 'Kino',
    template: '%s | Kino',
  },
  description,
  applicationName: 'Kino',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    description,
    images: ['/icons/icon-512.png'],
    siteName: 'Kino',
    title: 'Kino',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary',
    description,
    images: ['/icons/icon-512.png'],
    title: 'Kino',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kino',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1db954',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
