import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('movie shelf uses localized titles and the large profile row', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-movie-shelf.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileMovieShelf/)

  assert.match(source, /useLocalizedTitles/)
  assert.match(source, /ProfileTitleRow/)
  assert.match(source, /profileMoviesPath/)
  assert.match(source, /previewLimit=\{15\}/)
  assert.match(source, /showAllHref=\{profileMoviesPath\(username\)\}/)

  assert.doesNotMatch(source, /desktopShowAllAction/)
  assert.match(source, /profile-media-row--large/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)
})
