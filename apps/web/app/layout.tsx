import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { absoluteUrl, getSiteOrigin, SITE_NAME, socialImage } from '@/lib/seo/seo'
import { getServerMetadataContext } from '@/lib/seo/server-metadata'
import { getStandaloneModeBootstrapScript } from '@/lib/standalone-mode-bridge'
import { cn } from '@/lib/utils'
import { Providers } from './providers'

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerMetadataContext()
  const description = t('metadata.siteDescription')
  return {
    metadataBase: new URL(getSiteOrigin()),
    title: {
      default: 'Kino',
      template: '%s | Kino',
    },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: absoluteUrl('/') },
    openGraph: {
      description,
      locale,
      images: [socialImage('/opengraph-image', description)],
      siteName: SITE_NAME,
      title: SITE_NAME,
      type: 'website',
      url: absoluteUrl('/'),
    },
    twitter: {
      card: 'summary_large_image',
      description,
      images: [socialImage('/opengraph-image', description)],
      title: SITE_NAME,
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: SITE_NAME,
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      shortcut: '/favicon.ico',
      apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '192x192' }],
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#101112',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { language } = await getServerMetadataContext()

  return (
    <html lang={language} suppressHydrationWarning className={cn('font-sans')}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getStandaloneModeBootstrapScript() }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
