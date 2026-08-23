import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDiscoverSectionOrder } from '../../discover/section-ordering.ts'

function sectionTypes(order) {
  return order.map((section) => section.type)
}

test('keeps a simple editorial order when all sections have content', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 10,
    newSeriesCount: 8,
    upcomingCount: 12,
    rereleasesCount: 4,
  })

  assert.deepEqual(sectionTypes(result), [
    'primary',
    'new-releases',
    'new-series',
    'upcoming',
    'rereleases',
  ])
})

test('promotes substantial series updates ahead of the primary row', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 5,
    newReleasesCount: 20,
    newSeriesCount: 0,
    upcomingCount: 20,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), ['updates', 'primary', 'new-releases', 'upcoming'])
})

test('places smaller series updates after release sections', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 1,
    newReleasesCount: 20,
    newSeriesCount: 10,
    upcomingCount: 20,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), [
    'primary',
    'new-releases',
    'new-series',
    'updates',
    'upcoming',
  ])
})

test('omits empty editorial sections instead of leaving holes', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 0,
    newSeriesCount: 0,
    upcomingCount: 20,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), ['primary', 'upcoming'])
})

test('places new series alongside release editorial sections', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 20,
    newSeriesCount: 20,
    upcomingCount: 20,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), ['primary', 'new-releases', 'new-series', 'upcoming'])
})

test('omits the new series section when there are no recent series', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 20,
    newSeriesCount: 0,
    upcomingCount: 20,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), ['primary', 'new-releases', 'upcoming'])
})

test('keeps rereleases after upcoming titles', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 0,
    newSeriesCount: 0,
    upcomingCount: 12,
    rereleasesCount: 6,
  })

  assert.deepEqual(sectionTypes(result), ['primary', 'upcoming', 'rereleases'])
})

test('keeps the primary section when every optional section is empty', () => {
  const result = buildDiscoverSectionOrder({
    updatesCount: 0,
    newReleasesCount: 0,
    newSeriesCount: 0,
    upcomingCount: 0,
    rereleasesCount: 0,
  })

  assert.deepEqual(sectionTypes(result), ['primary'])
})
