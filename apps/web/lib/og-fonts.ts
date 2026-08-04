import { readFile } from 'node:fs/promises'

export const OG_SIZE = { width: 1200, height: 630 }

const FONT_URLS = {
  regular: new URL('./og-fonts/noto-sans-latin-400-normal.woff', import.meta.url),
  bold: new URL('./og-fonts/noto-sans-latin-700-normal.woff', import.meta.url),
  blackItalic: new URL('./og-fonts/noto-sans-latin-900-italic.woff', import.meta.url),
} as const

type OgFont = {
  name: string
  data: ArrayBuffer
  style: 'normal' | 'italic'
  weight: 400 | 700 | 900
}

let fontPromise: Promise<OgFont[]> | undefined

async function fetchFont(path: URL) {
  const data = await readFile(path)
  assertSupportedOpenType(data)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

function assertSupportedOpenType(data: Uint8Array) {
  const bytes = data.subarray(0, 4)
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
    .then(
      ([regular, bold, blackItalic]) =>
        [
          { name: 'Kino Body', data: regular, style: 'normal', weight: 400 },
          { name: 'Kino Body', data: bold, style: 'normal', weight: 700 },
          { name: 'Kino OG', data: blackItalic, style: 'italic', weight: 900 },
        ] satisfies OgFont[]
    )
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
