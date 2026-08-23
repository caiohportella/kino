import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import * as profileCollectionFilters from '../../profile/profile-collection-filters.ts'
import { DEFAULT_PROFILE_COLLECTION_FILTERS } from '../../profile/profile-collection-filters.ts'

const countActiveProfileCollectionFilters = Reflect.get(
  profileCollectionFilters,
  'countActiveProfileCollectionFilters'
)

const componentUrl = new URL(
  '../../../components/profile/collections/profile-collection-filters.tsx',
  import.meta.url
)

test('exposes the shared profile collection filtering controls', () => {
  assert.equal(existsSync(componentUrl), true, 'ProfileCollectionFilters component should exist')

  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /export function ProfileCollectionFilters/)

  assert.match(source, /state\.query/)
  assert.match(source, /state\.rating/)
  assert.match(source, /state\.watchType/)
  assert.match(source, /state\.year/)
  assert.match(source, /state\.decade/)
  assert.match(source, /state\.genre/)
  assert.match(source, /state\.minTmdbRating/)
  assert.match(source, /state\.sort/)

  assert.match(source, /onChange\(['"]query['"]/)
  assert.match(source, /onChange\(['"]minTmdbRating['"]/)

  assert.match(source, /SlidersHorizontal/)
  assert.match(source, /Dialog/)
  assert.match(source, /onReset/)

  for (const rating of ['5', '6', '7', '8', '9']) {
    assert.match(
      source,
      new RegExp(`value=["']${rating}["']`),
      `expected a ${rating}+ TMDB rating option`
    )
  }

  for (const sort of [
    'watched-desc',
    'watched-asc',
    'activity-desc',
    'activity-asc',
    'count-desc',
    'count-asc',
    'title-asc',
    'title-desc',
    'popularity-desc',
    'popularity-asc',
    'release-desc',
    'release-asc',
    'average-desc',
    'average-asc',
    'rating-desc',
    'rating-asc',
    'runtime-desc',
    'runtime-asc',
  ]) {
    assert.match(source, new RegExp(`['"]${sort}['"]`), `expected Diary-compatible sort ${sort}`)
  }
})

test('counts only active collection filters and ignores sort and page', () => {
  assert.equal(
    countActiveProfileCollectionFilters({
      ...DEFAULT_PROFILE_COLLECTION_FILTERS,
      query: '  alien  ',
      rating: '4',
      watchType: 'rewatch',
      year: '2026',
      decade: '2020',
      genre: '18',
      minTmdbRating: '7',
      sort: 'title-asc',
      page: 4,
    }),
    7
  )

  assert.equal(
    countActiveProfileCollectionFilters({
      ...DEFAULT_PROFILE_COLLECTION_FILTERS,
      query: '   ',
      sort: 'title-asc',
      page: 3,
    }),
    0
  )
})

test('renders collection sorting with the same grouped structure as Diary', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /function SortDropdown\(/,
    'collection sorting should use a dedicated grouped dropdown'
  )

  assert.match(
    source,
    /<SortDropdown[\s\S]*?onChange=\{\(value\) => onChange\(["']sort["'], value\)\}[\s\S]*?value=\{state\.sort\}/,
    'the collection sort control should use SortDropdown'
  )

  assert.match(
    source,
    /SORT_GROUPS\.map\(\(group,\s*index\) =>/,
    'sort options should remain grouped instead of being flattened'
  )

  assert.match(
    source,
    /diaryFilters\.sortGroups\.\$\{group\.key\}/,
    'each sort group should use the existing Diary group translation'
  )
})

test('keeps the sort menu blur shell stationary while its options scroll', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /<DropdownMenuContent[\s\S]*?className="overflow-hidden p-0"/,
    'the blurred dropdown shell itself should not scroll'
  )

  assert.match(
    source,
    /<div className="max-h-96 overflow-y-auto p-1">/,
    'sort options should scroll inside the stationary blurred shell'
  )
})

test('keeps collection search typing local before committing the URL query', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /const \[queryDraft,\s*setQueryDraft\]\s*=\s*useState\(state\.query\)/,
    'search should have a local draft independent from URL filter state'
  )

  assert.match(
    source,
    /window\.setTimeout\([\s\S]*?onChange\(['"]query['"],\s*queryDraft\)[\s\S]*?300/,
    'search should debounce URL filter updates'
  )

  assert.match(
    source,
    /value=\{queryDraft\}/,
    'the input should render the local draft while typing'
  )

  assert.match(
    source,
    /onChange=\{(?:setQueryDraft|\(value\)\s*=>\s*setQueryDraft\(value\))\}/,
    'typing should update the local draft immediately'
  )

  assert.doesNotMatch(
    source,
    /onChange=\{\(value\)\s*=>\s*onChange\(['"]query['"],\s*value\)\}/,
    'typing should not navigate on every keystroke'
  )
})
