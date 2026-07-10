import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kino',
    short_name: 'Kino',
    description: 'A calm, focused movie and series tracking companion.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#101112',
    theme_color: '#101112',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
