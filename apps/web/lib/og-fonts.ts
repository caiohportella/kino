export const OG_SIZE = { width: 1200, height: 630 }

// Noto Sans is licensed under the SIL Open Font License 1.1. These versioned,
// official Google Fonts assets keep binaries out of every Edge function bundle.
const FONT_URLS = {
  normal:
    'https://fonts.gstatic.com/s/notosans/v42/o-0bIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjc5a7duw.woff2',
  blackItalic:
    'https://fonts.gstatic.com/s/notosans/v42/o-0kIpQlx3QUlC5A4PNr4C5OaxRsfNNlKbCePevHtVtX57DGjDU1QJ4Z2VDSyA.woff2',
} as const

type OgFont = {
  name: string
  data: ArrayBuffer
  style: 'normal' | 'italic'
  weight: 400 | 700 | 900
}

let fontPromise: Promise<OgFont[]> | undefined

async function fetchFont(url: string) {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`Unable to load OG font (${response.status})`)
  return response.arrayBuffer()
}

export function loadOgFonts() {
  if (process.env.OG_DISABLE_REMOTE_FONTS === '1') return Promise.resolve([])

  fontPromise ??= Promise.all([
    fetchFont(FONT_URLS.normal),
    fetchFont(FONT_URLS.blackItalic),
  ])
    .then(([normal, blackItalic]) => [
      { name: 'Kino Body', data: normal, style: 'normal', weight: 400 },
      { name: 'Kino Body', data: normal, style: 'normal', weight: 700 },
      { name: 'Kino OG', data: blackItalic, style: 'italic', weight: 900 },
    ] satisfies OgFont[])
    .catch(() => [])

  return fontPromise
}

export async function getOgImageOptions(headers?: HeadersInit) {
  return {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
    headers,
  }
}
