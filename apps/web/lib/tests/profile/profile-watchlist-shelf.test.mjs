import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('watchlist shelf is a standalone profile component', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-watchlist-shelf.tsx', import.meta.url),
    'utf8'
  )

  const profileView = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileWatchlistShelf/)

  assert.match(source, /ProfileTitleRow/)
  assert.match(source, /watchlistPath/)
  assert.match(source, /watchlistCoverPath/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)

  assert.doesNotMatch(profileView, /function PublicWatchlistShelf/)
})
