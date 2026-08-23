import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ProfileView is a thin composition root', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /useProfileView/)
  assert.match(source, /useProfileSocial/)
  assert.doesNotMatch(source, /useProfileLatestActivity/)

  assert.match(source, /ProfileDashboardHero/)
  assert.match(source, /ProfileOverview/)
  assert.match(source, /ProfileSocialListDialog/)
  assert.match(source, /useProfileView/)
  assert.match(source, /useProfileSocial/)

  assert.doesNotMatch(
    source,
    /BannerPickerDialog/,
    'banner editing should not live in the thin profile composition root'
  )
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useQueryClient/)
  assert.doesNotMatch(source, /useEffect/)
  assert.doesNotMatch(source, /useMemo/)
  assert.doesNotMatch(source, /useState/)

  assert.doesNotMatch(source, /\bdb\./)

  assert.doesNotMatch(source, /profile-user-search/)
  assert.doesNotMatch(source, /searchUsers/)

  assert.doesNotMatch(source, /function ProfileStatCard/)
  assert.doesNotMatch(source, /function MovieRatingStat/)
  assert.doesNotMatch(source, /function SeriesRatingStat/)
  assert.doesNotMatch(source, /function SeriesShelf/)
  assert.doesNotMatch(source, /function PublicWatchlistShelf/)
})
