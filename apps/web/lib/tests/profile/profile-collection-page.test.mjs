import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const componentUrl = new URL(
  '../../../components/profile/collections/profile-collection-page.tsx',
  import.meta.url
)

test('composes the shared profile collection page from reusable collection boundaries', () => {
  assert.equal(existsSync(componentUrl), true, 'ProfileCollectionPage component should exist')

  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /export function ProfileCollectionPage/)

  assert.match(source, /useProfileCollection/)
  assert.match(source, /parseProfileCollectionFilters/)
  assert.match(source, /serializeProfileCollectionFilters/)
  assert.match(source, /countActiveProfileCollectionFilters/)
  assert.match(source, /filterAndSortProfileCollection/)
  assert.match(source, /paginateProfileCollection/)

  assert.match(source, /<ProfileCollectionFilters/)
  assert.match(source, /<ProfileCollectionGrid/)
  assert.match(source, /<ProfileCollectionShareButton/)
  assert.match(source, /<AppPagination/)

  assert.match(source, /useSearchParams/)
  assert.match(source, /useRouter/)
  assert.match(source, /usePathname/)
})

test('localizes only the current collection page and builds display poster URLs', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /useLocalizedTitles/)
  assert.match(source, /localizedTitleKey/)
  assert.match(source, /getTmdb\(\)\.getImageUrl/)

  assert.match(
    source,
    /useLocalizedTitles\(\s*pagination\.items\.map/s,
    'only the current paginated items should be localized'
  )

  assert.match(source, /localized\?\.title\s*\?\?\s*item\.title/)
  assert.match(source, /localized\?\.posterPath\s*\?\?\s*item\.posterPath/)
  assert.match(source, /localized\?\.year\s*\?\?\s*item\.releaseYear/)

  assert.match(source, /localizedTitleKey\(\{\s*tmdbId:\s*item\.tmdbId,\s*type:\s*item\.mediaType/s)

  assert.doesNotMatch(
    source,
    /useLocalizedTitles\(\s*items\.map/s,
    'the entire profile collection should not be localized eagerly'
  )
})

test('does not render the localized collection grid while localization is pending', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /localizedTitles\.isPending/)
  assert.match(source, /ProfileCollectionGridSkeleton/)

  assert.match(
    source,
    /localizedTitles\.isPending[\s\S]*?<ProfileCollectionGridSkeleton[\s\S]*?:[\s\S]*?<ProfileCollectionGrid/,
    'the real collection grid should only render after localized titles are ready'
  )
})

test('shows profile navigation and distinct collection page states', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /PageHeader/)
  assert.match(source, /EmptyState/)
  assert.match(source, /<Link/)
  assert.match(source, /href=\{profileHref\}/)

  assert.match(source, /backLabel/)
  assert.match(source, /profileHref/)

  assert.match(source, /collectionQuery\.isError/, 'query failures should have their own state')

  assert.match(
    source,
    /items\.length\s*===\s*0/,
    'a truly empty collection should have its own state'
  )

  assert.match(
    source,
    /pagination\.totalItems\s*===\s*0/,
    'filters with no matching results should have their own state'
  )

  assert.match(source, /errorTitle/)
  assert.match(source, /errorBody/)
  assert.match(source, /emptyTitle/)
  assert.match(source, /emptyBody/)
  assert.match(source, /noMatchesTitle/)
  assert.match(source, /noMatchesBody/)

  assert.match(
    source,
    /action=\{[\s\S]*?<ProfileCollectionShareButton/,
    'sharing should live in the PageHeader action area'
  )
})

test('uses the shared full-width content frame', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /<main className="content-frame">/,
    'profile collections should use the app-wide full-width content contract'
  )

  assert.doesNotMatch(
    source,
    /max-w-7xl/,
    'profile collections should not impose their own centered max width'
  )
})

test('uses a full-page collection pagination size', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /const PROFILE_COLLECTION_PAGE_SIZE = 72;?/,
    'collection pages should use a page size divisible by every responsive column count'
  )
})

test('resolves collection search against current-locale TMDb titles', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /createSearchGatewayClient/)
  assert.match(source, /SEARCH_SCHEMA_VERSION_V2/)
  assert.match(source, /getLocale\(language\)/)
  assert.match(source, /getRegion\(language\)/)

  assert.match(
    source,
    /mediaTypes:\s*\[mediaType === ['"]tv['"] \? ['"]series['"] : ['"]movie['"]\]/,
    'collection search should only ask for the current collection media type'
  )

  assert.match(
    source,
    /filterAndSortProfileCollection\([\s\S]*?localizedTmdbIds[\s\S]*?\)/,
    'localized TMDb matches should participate in collection filtering'
  )
})

test('shows the collection skeleton before evaluating the empty state', () => {
  const source = readFileSync(componentUrl, 'utf8')

  const pendingIndex = source.indexOf('collectionQuery.isPending')
  const emptyIndex = source.indexOf('items.length === 0')

  assert.notEqual(pendingIndex, -1, 'collection loading should have an explicit pending state')

  assert.ok(
    pendingIndex < emptyIndex,
    'pending collection state should be handled before the true empty state'
  )

  assert.match(
    source,
    /collectionQuery\.isPending[\s\S]*?<ProfileCollectionGridSkeleton/,
    'collection loading should render the grid skeleton'
  )
})
