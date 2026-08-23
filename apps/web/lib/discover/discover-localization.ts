import type { DiscoverCollection, DiscoverCollectionGroup } from './collections.ts'

type DiscoverTranslationValue = string | number | boolean | null | undefined

type DiscoverTranslateOptions = Record<string, DiscoverTranslationValue>

type DiscoverTranslate = (key: string, options?: DiscoverTranslateOptions) => string

/*
 * Collections
 */

export function getDiscoverCollectionTitle(t: DiscoverTranslate, collection: DiscoverCollection) {
  return t(collection.titleKey, {
    defaultValue: collection.titleDefault,
  })
}

export function getDiscoverCollectionDescription(
  t: DiscoverTranslate,
  collection: DiscoverCollection
) {
  return t(collection.descriptionKey, {
    defaultValue: collection.descriptionDefault,
  })
}

export function getDiscoverCollectionGroupTitle(
  t: DiscoverTranslate,
  group: DiscoverCollectionGroup
) {
  return t(group.titleKey, {
    defaultValue: group.titleDefault,
  })
}

export function getDiscoverExploreCollectionsLabel(t: DiscoverTranslate) {
  return t('discover.collections.heading', {
    defaultValue: 'Explore collections',
  })
}

export function getDiscoverExploreCollectionsDescription(t: DiscoverTranslate) {
  return t('discover.collections.subtitle', {
    defaultValue: 'Explore iconic franchises, sagas and cinematic universes.',
  })
}

export function getDiscoverCollectionActiveLabel(t: DiscoverTranslate) {
  return t('discover.collections.active', {
    defaultValue: 'Collection',
  })
}

export function getDiscoverCollectionClearLabel(t: DiscoverTranslate) {
  return t('discover.collections.clear', {
    defaultValue: 'Clear collection',
  })
}

export function getDiscoverCollectionOpenLabel(t: DiscoverTranslate) {
  return t('discover.collections.open', {
    defaultValue: 'Open collection',
  })
}
