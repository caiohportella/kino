import assert from 'node:assert/strict'
import test from 'node:test'

test('OG rendering falls back cleanly when remote fonts are disabled', async () => {
  process.env.OG_DISABLE_REMOTE_FONTS = '1'
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('font fetch should not run')
  }

  try {
    const { getOgImageOptions } = await import('./og-fonts.ts')
    const options = await getOgImageOptions()
    assert.deepEqual(options.fonts, [])
    assert.equal(options.width, 1200)
    assert.equal(options.height, 630)
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OG_DISABLE_REMOTE_FONTS
  }
})
