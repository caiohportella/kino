import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ProfileOverview composes profile content sections', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-overview.tsx', import.meta.url),
    'utf8'
  )

  const profileView = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileOverview/)

  assert.match(source, /ProfileMovieShelf/)
  assert.match(source, /ProfileSeriesShelf/)
  assert.match(source, /ProfileReviewsSection/)
  assert.match(source, /ProfileWatchlistShelf/)
  assert.match(source, /ProfileSectionState/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)

  assert.doesNotMatch(profileView, /ProfileReviewsSection/)
})
