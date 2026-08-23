const LOCAL_SITE_ORIGIN = 'http://localhost:3000'

function siteOrigin() {
  if (process.env.NODE_ENV === 'development') return LOCAL_SITE_ORIGIN

  const value =
    process.env.VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.EXPO_PUBLIC_WEB_URL

  // Vercel always exposes VERCEL_URL for deployed functions. Locally, point
  // back at the running Next.js server instead of an unrelated production host.
  if (!value) return LOCAL_SITE_ORIGIN
  const origin = value.replace(/\/+$/, '')
  return origin.startsWith('http://') || origin.startsWith('https://')
    ? origin
    : `https://${origin}`
}

// The landing page and OG renderer share this public asset. Keeping it as an
// absolute URL prevents the PNG bytes from being copied into Edge JavaScript.
export const KINO_OG_LOGO_URL = new URL('/kino-logo.png', siteOrigin()).toString()
