import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))

test('shared search stays independent from frameworks, providers, environments, and indexing', async () => {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.ts'))
  const sources = await Promise.all(
    files.map(async (file) => [file, await readFile(new URL(file, import.meta.url), 'utf8')])
  )
  const forbidden =
    /from\s+['"](?:react|next|expo|@supabase|@upstash|[^'"]*\/indexing(?:\/|['"])|[^'"]*server-env)/u

  for (const [file, source] of sources) {
    assert.doesNotMatch(source, forbidden, `${file} crossed the shared-search boundary`)
  }
})
