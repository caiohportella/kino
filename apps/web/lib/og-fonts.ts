import { OG_BLACK_ITALIC_BASE64 } from './og-font-data'
import { OG_BOLD_BASE64 } from './og-font-bold-data'
import { OG_REGULAR_BASE64 } from './og-font-regular-data'

export const OG_SIZE = { width: 1200, height: 630 }

function decodeFont(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)).buffer
}

export async function getOgImageOptions(headers?: HeadersInit) {
  return {
    ...OG_SIZE,
    fonts: [
      {
        name: 'Kino Body',
        data: decodeFont(OG_REGULAR_BASE64),
        style: 'normal' as const,
        weight: 400 as const,
      },
      {
        name: 'Kino Body',
        data: decodeFont(OG_BOLD_BASE64),
        style: 'normal' as const,
        weight: 700 as const,
      },
      {
        name: 'Kino OG',
        data: decodeFont(OG_BLACK_ITALIC_BASE64),
        style: 'italic' as const,
        weight: 900 as const,
      },
    ],
    headers,
  }
}
