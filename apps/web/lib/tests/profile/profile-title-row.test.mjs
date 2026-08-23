import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ProfileTitleRow supports responsive show-all behavior', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-title-row.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileTitleRow/)

  assert.match(source, /ProfileHorizontalRow/)
  assert.match(source, /ProfileModal/)
  assert.match(source, /PROFILE_ROW_LIMIT/)

  assert.match(source, /desktopShowAllAction/)

  assert.match(source, /rowClassName/)

  assert.match(source, /hidden lg:inline-flex/)

  assert.match(source, /lg:hidden/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /\bdb\./)
})

test('ProfileTitleRow keeps routed collection rows limited to the preview size', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-title-row.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /items\.slice\(0,\s*previewLimit\)\.map\(renderTitleCard\)/,
    'routed collection rows should keep a finite preview'
  )

  assert.doesNotMatch(
    source,
    /showAllHref\s*\?\s*items\.map\(renderTitleCard\)/,
    'View all should remain meaningful instead of rendering the entire collection'
  )
})
