import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('series shelf uses localized titles and the large profile row', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-series-shelf.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileSeriesShelf/)

  assert.match(source, /findNextKnownSeason/)
  assert.match(source, /useLocalizedTitles/)
  assert.match(source, /ProfileTitleRow/)
  assert.match(source, /SeriesStatusPill/)

  assert.match(source, /desktopShowAllAction/)

  assert.match(source, /profile-media-row--large/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)
})
