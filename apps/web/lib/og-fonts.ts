export const OG_SIZE = { width: 1200, height: 630 }

// Noto Sans is licensed under the SIL Open Font License 1.1. These versioned,
// official Google Fonts assets keep binaries out of every Edge function bundle.
const FONT_URLS = {
  regular:
    'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf',
  bold:
    'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAaBN9d.ttf',
  blackItalic:
    'https://fonts.gstatic.com/s/notosans/v42/o-0kIpQlx3QUlC5A4PNr4C5OaxRsfNNlKbCePevHtVtX57DGjDU1QJ4Z6Vc.ttf',
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
  const data = await response.arrayBuffer()
  assertSupportedOpenType(data)
  return data
}

function assertSupportedOpenType(data: ArrayBuffer) {
  const bytes = new Uint8Array(data, 0, Math.min(data.byteLength, 4))
  const signature = String.fromCharCode(...bytes)
  const isTrueType = bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0
  const isSupported = isTrueType || ['OTTO', 'true', 'typ1', 'wOFF'].includes(signature)
  if (!isSupported) throw new Error(`Unsupported OG font signature ${signature || 'empty'}`)
}

export function loadOgFonts() {
  if (process.env.OG_DISABLE_REMOTE_FONTS === '1') return Promise.resolve([])

  fontPromise ??= Promise.all([
    fetchFont(FONT_URLS.regular),
    fetchFont(FONT_URLS.bold),
    fetchFont(FONT_URLS.blackItalic),
  ])
    .then(([regular, bold, blackItalic]) => [
      { name: 'Kino Body', data: regular, style: 'normal', weight: 400 },
      { name: 'Kino Body', data: bold, style: 'normal', weight: 700 },
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
