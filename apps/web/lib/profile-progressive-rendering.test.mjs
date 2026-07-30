import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const coordinatorSource = await readFile(
  new URL('../components/profile-view.tsx', import.meta.url),
  'utf8'
)
const sectionHooksSource = await readFile(
  new URL('../hooks/use-profile-sections.ts', import.meta.url),
  'utf8'
)
const progressiveRendering = await import('./profile-section-presentation.ts').catch(() => null)
const progressiveState = await import('./profile-progressive-state.ts')

test('the web coordinator resolves a username once and keys every slice by canonical profile id', () => {
  assert.match(coordinatorSource, /useProfileUsernameResolution\(db, username\)/)
  assert.match(
    coordinatorSource,
    /const targetUserId =\s*profileId \|\| resolvedProfile\.data\?\.id/
  )
  assert.match(coordinatorSource, /useProfileIdentity\(identityInput\)/)
  assert.match(
    coordinatorSource,
    /useProfileSections\([\s\S]*profileId: targetUserId,[\s\S]*username: canonicalUsername/
  )
  assert.doesNotMatch(coordinatorSource, /\['profile-by-username', username\]/)
  assert.match(sectionHooksSource, /profileIdentityQueryOptions/)
  assert.match(sectionHooksSource, /profileWatchedMoviesQueryOptions/)
  assert.match(sectionHooksSource, /profileWatchedSeriesQueryOptions/)
})

test('identity is the only whole-page loading and error gate', () => {
  assert.match(coordinatorSource, /selectProfilePageState\(/)
  assert.match(coordinatorSource, /identityPageState\.phase === 'blocking'/)
  assert.match(coordinatorSource, /identityPageState\.phase === 'error'/)
  assert.doesNotMatch(coordinatorSource, /resolvedProfile\.isLoading \|\| query\.isLoading/)
  assert.doesNotMatch(coordinatorSource, /if \(!query\.data\?\.profile\)/)
})

test('content slices own independent state and keep retained content mounted', () => {
  assert.match(coordinatorSource, /selectProfileSliceState\(/)
  assert.match(coordinatorSource, /ProfileSectionState/)
  assert.match(coordinatorSource, /resolveProfileSectionPresentation\(state\)/)
  assert.match(coordinatorSource, /refetch\(\)/)
  assert.match(coordinatorSource, /isProfileKnownEmpty\(/)
})

test('stored series are rendered without initial availability fan-out', () => {
  assert.doesNotMatch(coordinatorSource, /refreshSeriesAvailability/)
  assert.doesNotMatch(coordinatorSource, /getSeasonDetails/)
  assert.doesNotMatch(
    coordinatorSource,
    /const \[profile, movies, storedSeries, counts, relationship, publicStats, publicWatchlists\]/
  )
})

test('reviews use the progressive canonical cache while mutations bridge the legacy cache domain', () => {
  assert.match(coordinatorSource, /sections\.reviews/)
  assert.match(coordinatorSource, /ProfileReviewsSection/)
  assert.match(sectionHooksSource, /profileReviewsQueryOptions/)
})

test('identity remains ready while a relationship slice independently fails with retry ownership', () => {
  assert.ok(progressiveRendering, 'the pure profile section presentation mapper must exist')
  const presentation = progressiveRendering.resolveProfileSectionPresentation({
    error: new Error('relationship failed'),
    phase: 'failed',
  })

  assert.deepEqual(presentation, { canRetry: true, kind: 'error' })
  assert.deepEqual(
    progressiveState.selectProfilePageState(
      {
        data: { id: 'profile-a' },
        dataOwnerId: 'profile-a',
        error: null,
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-a'
    ),
    { identity: { id: 'profile-a' }, phase: 'ready' }
  )
  assert.match(coordinatorSource, /ProfileRelationshipAction/)
  assert.match(coordinatorSource, /query=\{sections\.relationship\}/)
})

test('paused sections have a distinct offline presentation instead of an initial skeleton', () => {
  assert.ok(progressiveRendering, 'the pure profile section presentation mapper must exist')
  assert.deepEqual(
    progressiveRendering.resolveProfileSectionPresentation({ phase: 'initial-pending' }),
    { canRetry: false, kind: 'pending' }
  )
  assert.deepEqual(progressiveRendering.resolveProfileSectionPresentation({ phase: 'paused' }), {
    canRetry: true,
    kind: 'paused',
  })
  assert.match(coordinatorSource, /presentation\.kind === 'paused'/)
})

test('ratings distinguish unresolved, known-empty, and retained refresh failure states', () => {
  assert.ok(progressiveRendering, 'the pure profile section presentation mapper must exist')
  assert.deepEqual(
    progressiveRendering.resolveProfileSectionPresentation({ phase: 'initial-pending' }),
    { canRetry: false, kind: 'pending' }
  )
  assert.deepEqual(
    progressiveRendering.resolveProfileSectionPresentation({ data: {}, phase: 'empty' }),
    { busy: false, kind: 'content', refreshFailed: false }
  )
  assert.deepEqual(
    progressiveRendering.resolveProfileSectionPresentation({
      data: { 'series-a': 4 },
      empty: false,
      error: new Error('refresh failed'),
      phase: 'retained-refresh-error',
    }),
    { busy: false, kind: 'content', refreshFailed: true }
  )
  assert.match(coordinatorSource, /const ratingsState =[\s\S]*toSliceState\(seriesRatingQuery/)
  assert.match(coordinatorSource, /ProfileRatingStatState/)
})

test('presentation mapping preserves retained content and never crosses profile or viewer owners', () => {
  assert.ok(progressiveRendering, 'the pure profile section presentation mapper must exist')
  assert.deepEqual(
    progressiveRendering.resolveProfileSectionPresentation({
      data: [{ id: 'movie-a' }],
      empty: false,
      phase: 'retained-refresh',
    }),
    { busy: true, kind: 'content', refreshFailed: false }
  )
  assert.match(coordinatorSource, /toSliceState\([\s\S]*sections\.relationship,[\s\S]*targetUserId/)
  assert.match(sectionHooksSource, /viewerId/)
})
