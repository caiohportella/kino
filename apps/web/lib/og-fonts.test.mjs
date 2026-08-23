import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ImageResponse } from 'next/og.js'
import { createElement } from 'react'

test('OG rendering falls back cleanly when remote fonts are disabled', async () => {
  process.env.OG_DISABLE_REMOTE_FONTS = '1'
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('font fetch should not run')
  }

  try {
    const { getOgImageOptions } = await import('./og/og-fonts.ts')
    const options = await getOgImageOptions()
    assert.deepEqual(options.fonts, [])
    assert.equal(options.width, 1200)
    assert.equal(options.height, 630)
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OG_DISABLE_REMOTE_FONTS
  }
})

test('OG fonts can be rendered by ImageResponse', async () => {
  const font = await readFile(
    new URL('./og-fonts/noto-sans-latin-900-italic.woff', import.meta.url)
  )
  const options = {
    width: 1200,
    height: 630,
    fonts: [
      {
        data: font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
        name: 'Kino OG',
        style: 'italic',
        weight: 900,
      },
    ],
  }

  const response = new ImageResponse(
    createElement(
      'div',
      {
        style: {
          alignItems: 'center',
          background: '#121212',
          color: '#e8e8e5',
          display: 'flex',
          fontFamily: 'Kino OG',
          fontSize: 64,
          fontStyle: 'italic',
          fontWeight: 900,
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        },
      },
      'Kino.'
    ),
    options
  )
  const image = await response.arrayBuffer()
  assert.ok(image.byteLength > 1_000)
  assert.equal(response.headers.get('content-type'), 'image/png')
})
