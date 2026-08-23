export type DiscoverCollectionMediaType = 'movie' | 'tv'

export type DiscoverCollectionMediaRef = {
  tmdbId: number
  type: DiscoverCollectionMediaType
}

export type DiscoverCollectionMediaIdentity = `${DiscoverCollectionMediaType}:${number}`

type DiscoverCollectionSourceBase = {
  /**
   * Stable identifier used by collection views.
   *
   * Resolved titles retain the IDs of every source
   * that produced them.
   */
  id: string

  /**
   * Small safety valve for incomplete TMDb metadata.
   * These should remain exceptional rather than being
   * the primary collection definition.
   */
  include?: readonly DiscoverCollectionMediaRef[]

  /**
   * Removes known false positives from a dynamic
   * source.
   */
  exclude?: readonly DiscoverCollectionMediaRef[]
}

/**
 * Resolves the seed movie, reads its
 * belongs_to_collection relationship and then loads
 * the complete TMDb collection.
 *
 * No TMDb collection ID needs to be hardcoded.
 */
export type DiscoverTmdbCollectionSource = DiscoverCollectionSourceBase & {
  type: 'tmdb-collection'
  seed: DiscoverCollectionMediaRef
}

/**
 * Discovers titles carrying a TMDb keyword.
 *
 * `keywordId` is optional. When absent, the resolver
 * searches TMDb for `keywordQuery` and selects the
 * exact normalized keyword match.
 */
export type DiscoverTmdbKeywordSource = DiscoverCollectionSourceBase & {
  type: 'tmdb-keyword'

  keywordId?: number
  keywordQuery: string

  mediaTypes: readonly DiscoverCollectionMediaType[]

  /**
   * Additional /discover/movie or /discover/tv
   * parameters.
   */
  params?: Readonly<Record<string, string>>
}

/**
 * Combines any number of dynamic sources.
 *
 * Results are deduplicated by media type + TMDb ID,
 * while retaining all source IDs that matched.
 */
export type DiscoverCompositeSource = DiscoverCollectionSourceBase & {
  type: 'composite'
  sources: readonly DiscoverCollectionSource[]
}

/**
 * Intended only for exceptional cases where TMDb
 * provides no useful collection/keyword relationship.
 */
export type DiscoverExplicitSource = DiscoverCollectionSourceBase & {
  type: 'explicit'
  items: readonly DiscoverCollectionMediaRef[]
}

export type DiscoverCollectionSource =
  | DiscoverTmdbCollectionSource
  | DiscoverTmdbKeywordSource
  | DiscoverCompositeSource
  | DiscoverExplicitSource

type DiscoverCollectionViewBase = {
  id: string
  titleKey: string
  titleDefault: string
}

/**
 * All resolved titles ordered by release_date /
 * first_air_date.
 */
export type DiscoverReleaseOrderView = DiscoverCollectionViewBase & {
  type: 'release-order'
  direction?: 'asc' | 'desc'
}

/**
 * Shows everything originating from one or more
 * named collection sources.
 */
export type DiscoverSourceView = DiscoverCollectionViewBase & {
  type: 'source'
  sourceIds: readonly string[]
  sort?: 'release-order' | 'source-order'
}

/**
 * Dynamic movie/TV split.
 */
export type DiscoverMediaTypeView = DiscoverCollectionViewBase & {
  type: 'media-type'
  mediaType: DiscoverCollectionMediaType
  sort?: 'release-order'
}

export type DiscoverReleaseRangeView = DiscoverCollectionViewBase & {
  type: 'release-range'

  from?: string
  to?: string

  mediaType?: DiscoverCollectionMediaType

  sourceIds?: readonly string[]

  direction?: 'asc' | 'desc'
}

/**
 * Small editorial subset.
 *
 * Appropriate for a special row such as What If...?
 * but not for defining the franchise itself.
 */
export type DiscoverSelectionView = DiscoverCollectionViewBase & {
  type: 'selection'
  items: readonly DiscoverCollectionMediaRef[]
  sort?: 'release-order' | 'curated'
}

/**
 * Used only when TMDb cannot infer story chronology.
 *
 * Release order remains completely dynamic.
 */
export type DiscoverCuratedOrderView = DiscoverCollectionViewBase & {
  type: 'curated-order'
  order: readonly DiscoverCollectionMediaRef[]

  /**
   * false:
   * New titles appear automatically in Release
   * order but do not appear in story chronology
   * until their timeline position is known.
   */
  includeUnranked?: boolean
}

export type DiscoverCollectionView =
  | DiscoverReleaseOrderView
  | DiscoverSourceView
  | DiscoverMediaTypeView
  | DiscoverReleaseRangeView
  | DiscoverSelectionView
  | DiscoverCuratedOrderView

/**
 * Compatibility name used by localization helpers.
 */
export type DiscoverCollectionGroup = DiscoverCollectionView

export type DiscoverCollectionDefinition = {
  id: string

  titleKey: string
  titleDefault: string

  descriptionKey: string
  descriptionDefault: string

  hero: DiscoverCollectionMediaRef

  source: DiscoverCollectionSource

  views: readonly DiscoverCollectionView[]
}

function movie(tmdbId: number): DiscoverCollectionMediaRef {
  return {
    tmdbId,
    type: 'movie',
  }
}

function tv(tmdbId: number): DiscoverCollectionMediaRef {
  return {
    tmdbId,
    type: 'tv',
  }
}

export function discoverCollectionMediaIdentity(
  item: DiscoverCollectionMediaRef
): DiscoverCollectionMediaIdentity {
  return `${item.type}:${item.tmdbId}`
}

/*
 * ──────────────────────────────────────────────
 * MCU
 * ──────────────────────────────────────────────
 *
 * Franchise membership is dynamic.
 *
 * The timeline remains curated because TMDb has
 * release information but does not expose an MCU
 * story chronology.
 */

const MCU_TIMELINE_ORDER = [
  movie(1771), // Captain America: The First Avenger

  movie(211387), // Marvel One-Shot: Agent Carter

  movie(299537), // Captain Marvel

  movie(1726), // Iron Man
  movie(10138), // Iron Man 2
  movie(1724), // The Incredible Hulk

  movie(76122), // Marvel One-Shot: The Consultant
  movie(76535), // A Funny Thing Happened on the Way to Thor's Hammer

  movie(10195), // Thor
  movie(24428), // The Avengers

  movie(119569), // Marvel One-Shot: Item 47

  movie(68721), // Iron Man 3

  movie(253980), // Marvel One-Shot: All Hail the King

  // ...keep the remainder of your existing order
] as const satisfies readonly DiscoverCollectionMediaRef[]
const MCU_WHAT_IF = [tv(91363)] as const satisfies readonly DiscoverCollectionMediaRef[]

/*
 * The MCU keyword is reliable enough that Kino can
 * use its numeric ID directly rather than resolving
 * the keyword name on every request.
 */
const MCU_MAIN_SOURCE: DiscoverCollectionSource = {
  id: 'mcu-main',
  type: 'tmdb-keyword',

  keywordId: 180547,
  keywordQuery: 'marvel cinematic universe (mcu)',

  mediaTypes: ['movie', 'tv'],

  include: [
    tv(91363), // What If...?
  ],
}

const MCU_ONE_SHOTS_SOURCE: DiscoverCollectionSource = {
  id: 'mcu-one-shots',
  type: 'tmdb-keyword',

  keywordId: 180547,
  keywordQuery: 'marvel cinematic universe (mcu)',

  mediaTypes: ['movie'],

  params: {
    'with_runtime.lte': '20',
    'primary_release_date.gte': '2011-01-01',
    'primary_release_date.lte': '2014-12-31',
  },
}

const MCU_SOURCE: DiscoverCollectionSource = {
  id: 'mcu-all',
  type: 'composite',

  sources: [MCU_MAIN_SOURCE, MCU_ONE_SHOTS_SOURCE],
}

/*
 * ──────────────────────────────────────────────
 * Star Wars
 * ──────────────────────────────────────────────
 */

const STAR_WARS_SOURCE: DiscoverCollectionSource = {
  id: 'star-wars-all',
  type: 'composite',

  sources: [
    {
      id: 'star-wars-films',
      type: 'tmdb-collection',
      seed: movie(11),
    },

    {
      id: 'star-wars-universe',
      type: 'tmdb-keyword',
      keywordQuery: 'star wars',
      mediaTypes: ['movie', 'tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Wizarding World
 * ──────────────────────────────────────────────
 */

const WIZARDING_WORLD_SOURCE: DiscoverCollectionSource = {
  id: 'wizarding-world-all',
  type: 'composite',

  sources: [
    {
      id: 'harry-potter',
      type: 'tmdb-collection',
      seed: movie(671),
    },

    {
      id: 'fantastic-beasts',
      type: 'tmdb-collection',
      seed: movie(259316),
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Middle-earth
 * ──────────────────────────────────────────────
 */

const MIDDLE_EARTH_SOURCE: DiscoverCollectionSource = {
  id: 'middle-earth-all',
  type: 'composite',

  sources: [
    {
      id: 'lord-of-the-rings',
      type: 'tmdb-collection',
      seed: movie(120),
    },

    {
      id: 'the-hobbit',
      type: 'tmdb-collection',
      seed: movie(49051),
    },

    {
      id: 'middle-earth-series',
      type: 'tmdb-keyword',
      keywordQuery: 'middle-earth',
      mediaTypes: ['tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Jurassic
 * ──────────────────────────────────────────────
 */

const JURASSIC_SOURCE: DiscoverCollectionSource = {
  id: 'jurassic-all',
  type: 'composite',

  sources: [
    {
      id: 'jurassic-films',
      type: 'tmdb-collection',
      seed: movie(329),
    },

    {
      id: 'jurassic-series',
      type: 'tmdb-keyword',
      keywordQuery: 'jurassic world',
      mediaTypes: ['tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Pirates of the Caribbean
 * ──────────────────────────────────────────────
 */

const PIRATES_SOURCE: DiscoverCollectionSource = {
  id: 'pirates-films',
  type: 'tmdb-collection',
  seed: movie(22),
}

/*
 * ──────────────────────────────────────────────
 * Godfather
 * ──────────────────────────────────────────────
 */

const GODFATHER_SOURCE: DiscoverCollectionSource = {
  id: 'godfather-films',
  type: 'tmdb-collection',
  seed: movie(238),
}

/*
 * ──────────────────────────────────────────────
 * Matrix
 * ──────────────────────────────────────────────
 */

const MATRIX_SOURCE: DiscoverCollectionSource = {
  id: 'matrix-films',
  type: 'tmdb-collection',
  seed: movie(603),
}

/*
 * ──────────────────────────────────────────────
 * Rocky / Creed
 * ──────────────────────────────────────────────
 */

const ROCKY_CREED_SOURCE: DiscoverCollectionSource = {
  id: 'rocky-creed-all',
  type: 'composite',

  sources: [
    {
      id: 'rocky',
      type: 'tmdb-collection',
      seed: movie(1366),
    },

    {
      id: 'creed',
      type: 'tmdb-collection',
      seed: movie(312221),
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * John Wick
 * ──────────────────────────────────────────────
 */

const JOHN_WICK_SOURCE: DiscoverCollectionSource = {
  id: 'john-wick-all',
  type: 'composite',

  sources: [
    {
      id: 'john-wick-films',
      type: 'tmdb-collection',
      seed: movie(245891),
    },

    {
      id: 'john-wick-universe',
      type: 'tmdb-keyword',
      keywordQuery: 'john wick',
      mediaTypes: ['movie', 'tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Alien
 * ──────────────────────────────────────────────
 */

const ALIEN_SOURCE: DiscoverCollectionSource = {
  id: 'alien-all',
  type: 'composite',

  sources: [
    {
      id: 'alien-original',
      type: 'tmdb-collection',
      seed: movie(348),
    },

    {
      id: 'alien-prequels',
      type: 'tmdb-collection',
      seed: movie(70981),
    },

    {
      id: 'alien-vs-predator',
      type: 'tmdb-collection',
      seed: movie(395),
    },

    {
      id: 'alien-universe',
      type: 'tmdb-keyword',
      keywordQuery: 'alien franchise',
      mediaTypes: ['movie', 'tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * James Bond
 * ──────────────────────────────────────────────
 */

const JAMES_BOND_SOURCE: DiscoverCollectionSource = {
  id: 'james-bond-films',
  type: 'tmdb-collection',
  seed: movie(646),

  // exclude: [
  //   movie(12208), // Casino Royale (1967)
  //   movie(36670), // Never Say Never Again
  // ],
}

/*
 * ──────────────────────────────────────────────
 * Planet of the Apes
 * ──────────────────────────────────────────────
 */

const PLANET_OF_THE_APES_SOURCE: DiscoverCollectionSource = {
  id: 'apes-all',
  type: 'composite',

  sources: [
    {
      id: 'apes-original',
      type: 'tmdb-collection',
      seed: movie(871),
    },

    {
      id: 'apes-reimagining',
      type: 'tmdb-collection',
      seed: movie(869),
    },

    {
      id: 'apes-modern',
      type: 'tmdb-collection',
      seed: movie(61791),
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Mission: Impossible
 * ──────────────────────────────────────────────
 */

const MISSION_IMPOSSIBLE_SOURCE: DiscoverCollectionSource = {
  id: 'mission-impossible-films',
  type: 'tmdb-collection',
  seed: movie(954),
}

/*
 * ──────────────────────────────────────────────
 * DC
 * ──────────────────────────────────────────────
 *
 * DC is not one continuity, so its dynamic source
 * explicitly combines its major universe labels.
 */

const DC_SOURCE: DiscoverCollectionSource = {
  id: 'dc-all',
  type: 'composite',

  sources: [
    {
      id: 'dc-batman',
      type: 'tmdb-keyword',
      keywordQuery: 'batman',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-superman',
      type: 'tmdb-keyword',
      keywordQuery: 'superman',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-wonder-woman',
      type: 'tmdb-keyword',
      keywordQuery: 'wonder woman',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-aquaman',
      type: 'tmdb-keyword',
      keywordQuery: 'aquaman',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-flash',
      type: 'tmdb-keyword',
      keywordQuery: 'the flash',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-green-lantern',
      type: 'tmdb-keyword',
      keywordQuery: 'green lantern',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dc-shazam',
      type: 'tmdb-keyword',
      keywordQuery: 'shazam',
      mediaTypes: ['movie', 'tv'],
    },
    {
      id: 'dceu',
      type: 'tmdb-keyword',
      keywordQuery: 'dc extended universe (dceu)',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'dcu',
      type: 'tmdb-keyword',
      keywordQuery: 'dc universe (dcu)',
      mediaTypes: ['movie', 'tv'],
    },

    {
      id: 'the-batman',
      type: 'tmdb-collection',
      seed: movie(414906),
    },

    {
      id: 'joker',
      type: 'tmdb-collection',
      seed: movie(475557),
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Fast & Furious
 * ──────────────────────────────────────────────
 */

const FAST_AND_FURIOUS_SOURCE: DiscoverCollectionSource = {
  id: 'fast-and-furious-all',
  type: 'composite',

  sources: [
    {
      id: 'fast-saga',
      type: 'tmdb-collection',
      seed: movie(9799),
    },

    {
      id: 'fast-universe',
      type: 'tmdb-keyword',
      keywordQuery: 'fast & furious',
      mediaTypes: ['movie', 'tv'],
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Toy Story
 * ──────────────────────────────────────────────
 */

const TOY_STORY_SOURCE: DiscoverCollectionSource = {
  id: 'toy-story-all',
  type: 'composite',

  sources: [
    {
      id: 'toy-story-films',
      type: 'tmdb-collection',
      seed: movie(862),
    },

    {
      id: 'toy-story-universe',
      type: 'tmdb-keyword',
      keywordQuery: 'toy story',
      mediaTypes: ['movie', 'tv'],

      /*
       * Avoid tiny shorts dominating the additional
       * movie source.
       */
      params: {
        'with_runtime.gte': '45',
      },
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Shrek
 * ──────────────────────────────────────────────
 */

const SHREK_SOURCE: DiscoverCollectionSource = {
  id: 'shrek-all',
  type: 'composite',

  sources: [
    {
      id: 'shrek',
      type: 'tmdb-collection',
      seed: movie(808),
    },

    {
      id: 'puss-in-boots',
      type: 'tmdb-collection',
      seed: movie(417859),
    },
  ],
}

/*
 * ──────────────────────────────────────────────
 * Registry
 * ──────────────────────────────────────────────
 */

export const DISCOVER_COLLECTIONS = [
  {
    id: 'star-wars',

    titleKey: 'discover.collections.starWars.title',
    titleDefault: 'Star Wars',

    descriptionKey: 'discover.collections.starWars.description',
    descriptionDefault: 'Explore the films and series from a galaxy far, far away.',

    hero: movie(11),

    source: STAR_WARS_SOURCE,

    views: [
      {
        id: 'skywalker-saga',
        type: 'source',

        titleKey: 'discover.collections.starWars.groups.skywalkerSaga',
        titleDefault: 'The Skywalker Saga',

        sourceIds: ['star-wars-films'],
        sort: 'release-order',
      },

      {
        id: 'movies',
        type: 'media-type',

        titleKey: 'discover.collections.starWars.groups.movies',
        titleDefault: 'Movies',

        mediaType: 'movie',
        sort: 'release-order',
      },

      {
        id: 'series',
        type: 'media-type',

        titleKey: 'discover.collections.starWars.groups.series',
        titleDefault: 'Series',

        mediaType: 'tv',
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.starWars.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'mcu',

    titleKey: 'discover.collections.mcu.title',
    titleDefault: 'Marvel Cinematic Universe',

    descriptionKey: 'discover.collections.mcu.description',
    descriptionDefault: 'Explore the Marvel Cinematic Universe in chronological and release order.',

    hero: movie(299534),

    source: MCU_SOURCE,

    views: [
      {
        id: 'chronological',
        type: 'curated-order',

        titleKey: 'discover.collections.mcu.groups.chronological',
        titleDefault: 'Chronological order',

        order: MCU_TIMELINE_ORDER,
        includeUnranked: false,
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.mcu.groups.releaseOrder',
        titleDefault: 'Release order',
      },

      {
        id: 'what-if',
        type: 'selection',

        titleKey: 'discover.collections.mcu.groups.whatIf',
        titleDefault: 'What If...?',

        items: MCU_WHAT_IF,
        sort: 'curated',
      },

      {
        id: 'one-shots',
        type: 'source',

        titleKey: 'discover.collections.mcu.groups.oneShots',
        titleDefault: 'Marvel One-Shots',

        sourceIds: ['mcu-one-shots'],
        sort: 'release-order',
      },

      {
        id: 'movies',
        type: 'media-type',

        titleKey: 'discover.collections.mcu.groups.movies',
        titleDefault: 'Movies',

        mediaType: 'movie',
        sort: 'release-order',
      },

      {
        id: 'series',
        type: 'media-type',

        titleKey: 'discover.collections.mcu.groups.series',
        titleDefault: 'Series',

        mediaType: 'tv',
        sort: 'release-order',
      },
    ],
  },

  {
    id: 'wizarding-world',

    titleKey: 'discover.collections.wizardingWorld.title',
    titleDefault: 'Wizarding World',

    descriptionKey: 'discover.collections.wizardingWorld.description',
    descriptionDefault: 'Return to Hogwarts and explore the wider Wizarding World.',

    hero: movie(671),

    source: WIZARDING_WORLD_SOURCE,

    views: [
      {
        id: 'harry-potter',
        type: 'source',

        titleKey: 'discover.collections.wizardingWorld.groups.harryPotter',
        titleDefault: 'Harry Potter',

        sourceIds: ['harry-potter'],
        sort: 'release-order',
      },

      {
        id: 'fantastic-beasts',
        type: 'source',

        titleKey: 'discover.collections.wizardingWorld.groups.fantasticBeasts',
        titleDefault: 'Fantastic Beasts',

        sourceIds: ['fantastic-beasts'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.wizardingWorld.groups.releaseOrder',
        titleDefault: 'Complete release order',
      },
    ],
  },

  {
    id: 'middle-earth',

    titleKey: 'discover.collections.middleEarth.title',
    titleDefault: 'Middle-earth',

    descriptionKey: 'discover.collections.middleEarth.description',
    descriptionDefault: 'Journey through the stories of Middle-earth.',

    hero: movie(120),

    source: MIDDLE_EARTH_SOURCE,

    views: [
      {
        id: 'lord-of-the-rings',
        type: 'source',

        titleKey: 'discover.collections.middleEarth.groups.lordOfTheRings',
        titleDefault: 'The Lord of the Rings',

        sourceIds: ['lord-of-the-rings'],
        sort: 'release-order',
      },

      {
        id: 'the-hobbit',
        type: 'source',

        titleKey: 'discover.collections.middleEarth.groups.hobbit',
        titleDefault: 'The Hobbit',

        sourceIds: ['the-hobbit'],
        sort: 'release-order',
      },

      {
        id: 'series',
        type: 'source',

        titleKey: 'discover.collections.middleEarth.groups.series',
        titleDefault: 'Series',

        sourceIds: ['middle-earth-series'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.middleEarth.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'jurassic',

    titleKey: 'discover.collections.jurassic.title',
    titleDefault: 'Jurassic',

    descriptionKey: 'discover.collections.jurassic.description',
    descriptionDefault: 'Return to Isla Nublar and explore the Jurassic franchise.',

    hero: movie(329),

    source: JURASSIC_SOURCE,

    views: [
      {
        id: 'jurassic-park-era',
        type: 'release-range',

        titleKey: 'discover.collections.jurassic.groups.parkEra',
        titleDefault: 'Jurassic Park era',

        from: '1993-01-01',
        to: '2001-12-31',

        mediaType: 'movie',
      },

      {
        id: 'jurassic-world-era',
        type: 'release-range',

        titleKey: 'discover.collections.jurassic.groups.worldEra',
        titleDefault: 'Jurassic World era',

        from: '2015-01-01',

        mediaType: 'movie',
      },
      {
        id: 'movies',
        type: 'source',

        titleKey: 'discover.collections.jurassic.groups.movies',
        titleDefault: 'Movies',

        sourceIds: ['jurassic-films'],
        sort: 'release-order',
      },

      {
        id: 'series',
        type: 'source',

        titleKey: 'discover.collections.jurassic.groups.series',
        titleDefault: 'Series',

        sourceIds: ['jurassic-series'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.jurassic.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'pirates-of-the-caribbean',

    titleKey: 'discover.collections.pirates.title',
    titleDefault: 'Pirates of the Caribbean',

    descriptionKey: 'discover.collections.pirates.description',
    descriptionDefault: 'Sail through the Pirates of the Caribbean saga.',

    hero: movie(22),

    source: PIRATES_SOURCE,

    views: [
      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.pirates.groups.films',
        titleDefault: 'Films',
      },
    ],
  },

  {
    id: 'the-godfather',

    titleKey: 'discover.collections.godfather.title',
    titleDefault: 'The Godfather',

    descriptionKey: 'discover.collections.godfather.description',
    descriptionDefault: 'Follow the Corleone family across the complete crime saga.',

    hero: movie(238),

    source: GODFATHER_SOURCE,

    views: [
      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.godfather.groups.films',
        titleDefault: 'The Godfather saga',
      },
    ],
  },

  {
    id: 'the-matrix',

    titleKey: 'discover.collections.matrix.title',
    titleDefault: 'The Matrix',

    descriptionKey: 'discover.collections.matrix.description',
    descriptionDefault: 'Enter the Matrix and follow the complete saga.',

    hero: movie(603),

    source: MATRIX_SOURCE,

    views: [
      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.matrix.groups.films',
        titleDefault: 'Films',
      },
    ],
  },

  {
    id: 'rocky-creed',

    titleKey: 'discover.collections.rockyCreed.title',
    titleDefault: 'Rocky & Creed',

    descriptionKey: 'discover.collections.rockyCreed.description',
    descriptionDefault: 'Step into the ring across the Rocky and Creed generations.',

    hero: movie(312221),

    source: ROCKY_CREED_SOURCE,

    views: [
      {
        id: 'rocky',
        type: 'source',

        titleKey: 'discover.collections.rockyCreed.groups.rocky',
        titleDefault: 'Rocky',

        sourceIds: ['rocky'],
        sort: 'release-order',
      },

      {
        id: 'creed',
        type: 'source',

        titleKey: 'discover.collections.rockyCreed.groups.creed',
        titleDefault: 'Creed',

        sourceIds: ['creed'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.rockyCreed.groups.releaseOrder',
        titleDefault: 'Complete release order',
      },
    ],
  },

  {
    id: 'john-wick',

    titleKey: 'discover.collections.johnWick.title',
    titleDefault: 'John Wick',

    descriptionKey: 'discover.collections.johnWick.description',
    descriptionDefault: 'Enter the criminal underworld of the John Wick universe.',

    hero: movie(245891),

    source: JOHN_WICK_SOURCE,

    views: [
      {
        id: 'films',
        type: 'source',

        titleKey: 'discover.collections.johnWick.groups.saga',
        titleDefault: 'John Wick saga',

        sourceIds: ['john-wick-films'],
        sort: 'release-order',
      },

      {
        id: 'universe',
        type: 'source',

        titleKey: 'discover.collections.johnWick.groups.universe',
        titleDefault: 'The wider universe',

        sourceIds: ['john-wick-universe'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.johnWick.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'alien',

    titleKey: 'discover.collections.alien.title',
    titleDefault: 'Alien',

    descriptionKey: 'discover.collections.alien.description',
    descriptionDefault: 'Explore the terrifying worlds of the Alien franchise.',

    hero: movie(348),

    source: ALIEN_SOURCE,

    views: [
      {
        id: 'original',
        type: 'source',

        titleKey: 'discover.collections.alien.groups.original',
        titleDefault: 'The original saga',

        sourceIds: ['alien-original'],
        sort: 'release-order',
      },

      {
        id: 'prequels',
        type: 'source',

        titleKey: 'discover.collections.alien.groups.origins',
        titleDefault: 'Origins & prequels',

        sourceIds: ['alien-prequels'],
        sort: 'release-order',
      },

      {
        id: 'crossovers',
        type: 'source',

        titleKey: 'discover.collections.alien.groups.crossovers',
        titleDefault: 'Crossovers',

        sourceIds: ['alien-vs-predator'],
        sort: 'release-order',
      },

      {
        id: 'series',
        type: 'media-type',

        titleKey: 'discover.collections.alien.groups.series',
        titleDefault: 'Series',

        mediaType: 'tv',
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.alien.groups.releaseOrder',
        titleDefault: 'Complete release order',
      },
    ],
  },

  {
    id: 'james-bond',

    titleKey: 'discover.collections.jamesBond.title',
    titleDefault: 'James Bond',

    descriptionKey: 'discover.collections.jamesBond.description',
    descriptionDefault: 'Follow 007 across decades of missions, villains and espionage.',

    hero: movie(37724),

    source: JAMES_BOND_SOURCE,

    views: [
      {
        id: 'classic-era',
        type: 'release-range',

        titleKey: 'discover.collections.jamesBond.groups.classic',
        titleDefault: 'The classic era',

        from: '1962-01-01',
        to: '1971-12-31',

        mediaType: 'movie',
      },

      {
        id: 'roger-moore-era',
        type: 'release-range',

        titleKey: 'discover.collections.jamesBond.groups.rogerMoore',
        titleDefault: 'The Roger Moore era',

        from: '1973-01-01',
        to: '1985-12-31',

        mediaType: 'movie',
      },

      {
        id: 'dalton-brosnan-era',
        type: 'release-range',

        titleKey: 'discover.collections.jamesBond.groups.daltonBrosnan',
        titleDefault: 'Dalton & Brosnan',

        from: '1987-01-01',
        to: '2002-12-31',

        mediaType: 'movie',
      },

      {
        id: 'daniel-craig-era',
        type: 'release-range',

        titleKey: 'discover.collections.jamesBond.groups.danielCraig',
        titleDefault: 'The Daniel Craig era',

        from: '2006-01-01',
        to: '2021-12-31',

        mediaType: 'movie',
      },
      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.jamesBond.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'planet-of-the-apes',

    titleKey: 'discover.collections.planetOfTheApes.title',
    titleDefault: 'Planet of the Apes',

    descriptionKey: 'discover.collections.planetOfTheApes.description',
    descriptionDefault: 'Explore every era of the Planet of the Apes franchise.',

    hero: movie(281338),

    source: PLANET_OF_THE_APES_SOURCE,

    views: [
      {
        id: 'originals',
        type: 'source',

        titleKey: 'discover.collections.planetOfTheApes.groups.originals',
        titleDefault: 'The original films',

        sourceIds: ['apes-original'],
        sort: 'release-order',
      },

      {
        id: 'reimagining',
        type: 'source',

        titleKey: 'discover.collections.planetOfTheApes.groups.reimagining',
        titleDefault: 'Reimagining',

        sourceIds: ['apes-reimagining'],
        sort: 'release-order',
      },

      {
        id: 'modern',
        type: 'source',

        titleKey: 'discover.collections.planetOfTheApes.groups.caesar',
        titleDefault: 'The modern saga',

        sourceIds: ['apes-modern'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.planetOfTheApes.groups.releaseOrder',
        titleDefault: 'Complete release order',
      },
    ],
  },

  {
    id: 'mission-impossible',

    titleKey: 'discover.collections.missionImpossible.title',
    titleDefault: 'Mission: Impossible',

    descriptionKey: 'discover.collections.missionImpossible.description',
    descriptionDefault: 'Follow Ethan Hunt through the complete Mission: Impossible series.',

    hero: movie(353081),

    source: MISSION_IMPOSSIBLE_SOURCE,

    views: [
      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.missionImpossible.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'dc',

    titleKey: 'discover.collections.dc.title',
    titleDefault: 'DC',

    descriptionKey: 'discover.collections.dc.description',
    descriptionDefault: "Explore DC's connected universes and alternate interpretations.",

    hero: movie(49521),

    source: DC_SOURCE,

    views: [
      {
        id: 'dceu',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.dceu',
        titleDefault: 'DC Extended Universe',

        sourceIds: ['dceu'],
        sort: 'release-order',
      },

      {
        id: 'dcu',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.dcu',
        titleDefault: 'DC Universe',

        sourceIds: ['dcu'],
        sort: 'release-order',
      },

      {
        id: 'the-batman',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.theBatman',
        titleDefault: 'The Batman universe',

        sourceIds: ['the-batman'],
        sort: 'release-order',
      },

      {
        id: 'joker',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.joker',
        titleDefault: 'Joker',

        sourceIds: ['joker'],
        sort: 'release-order',
      },
      {
        id: 'batman',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.batman',
        titleDefault: 'Batman',

        sourceIds: ['dc-batman'],
        sort: 'release-order',
      },

      {
        id: 'superman',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.superman',
        titleDefault: 'Superman',

        sourceIds: ['dc-superman'],
        sort: 'release-order',
      },

      {
        id: 'wonder-woman',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.wonderWoman',
        titleDefault: 'Wonder Woman',

        sourceIds: ['dc-wonder-woman'],
        sort: 'release-order',
      },

      {
        id: 'aquaman',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.aquaman',
        titleDefault: 'Aquaman',

        sourceIds: ['dc-aquaman'],
        sort: 'release-order',
      },

      {
        id: 'flash',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.flash',
        titleDefault: 'The Flash',

        sourceIds: ['dc-flash'],
        sort: 'release-order',
      },

      {
        id: 'green-lantern',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.greenLantern',
        titleDefault: 'Green Lantern',

        sourceIds: ['dc-green-lantern'],
        sort: 'release-order',
      },

      {
        id: 'shazam',
        type: 'source',

        titleKey: 'discover.collections.dc.groups.shazam',
        titleDefault: 'Shazam',

        sourceIds: ['dc-shazam'],
        sort: 'release-order',
      },
    ],
  },

  {
    id: 'fast-and-furious',

    titleKey: 'discover.collections.fastAndFurious.title',
    titleDefault: 'Fast & Furious',

    descriptionKey: 'discover.collections.fastAndFurious.description',
    descriptionDefault: 'Follow the Fast saga from street racing to globe-spanning missions.',

    hero: movie(51497),

    source: FAST_AND_FURIOUS_SOURCE,

    views: [
      {
        id: 'main-saga',
        type: 'source',

        titleKey: 'discover.collections.fastAndFurious.groups.mainSaga',
        titleDefault: 'The Fast Saga',

        sourceIds: ['fast-saga'],
        sort: 'release-order',
      },

      {
        id: 'universe',
        type: 'source',

        titleKey: 'discover.collections.fastAndFurious.groups.universe',
        titleDefault: 'The wider universe',

        sourceIds: ['fast-universe'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.fastAndFurious.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'toy-story',

    titleKey: 'discover.collections.toyStory.title',
    titleDefault: 'Toy Story',

    descriptionKey: 'discover.collections.toyStory.description',
    descriptionDefault: 'Follow Woody, Buzz and the toys across their adventures.',

    hero: movie(862),

    source: TOY_STORY_SOURCE,

    views: [
      {
        id: 'main-series',
        type: 'source',

        titleKey: 'discover.collections.toyStory.groups.main',
        titleDefault: 'Toy Story',

        sourceIds: ['toy-story-films'],
        sort: 'release-order',
      },

      {
        id: 'wider-universe',
        type: 'source',

        titleKey: 'discover.collections.toyStory.groups.spinoffs',
        titleDefault: 'The wider Toy Story universe',

        sourceIds: ['toy-story-universe'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.toyStory.groups.releaseOrder',
        titleDefault: 'Release order',
      },
    ],
  },

  {
    id: 'shrek',

    titleKey: 'discover.collections.shrek.title',
    titleDefault: 'Shrek',

    descriptionKey: 'discover.collections.shrek.description',
    descriptionDefault: 'Return to Far Far Away with Shrek, Donkey and Puss in Boots.',

    hero: movie(808),

    source: SHREK_SOURCE,

    views: [
      {
        id: 'shrek',
        type: 'source',

        titleKey: 'discover.collections.shrek.groups.shrek',
        titleDefault: 'Shrek',

        sourceIds: ['shrek'],
        sort: 'release-order',
      },

      {
        id: 'puss-in-boots',
        type: 'source',

        titleKey: 'discover.collections.shrek.groups.pussInBoots',
        titleDefault: 'Puss in Boots',

        sourceIds: ['puss-in-boots'],
        sort: 'release-order',
      },

      {
        id: 'release-order',
        type: 'release-order',

        titleKey: 'discover.collections.shrek.groups.releaseOrder',
        titleDefault: 'Complete release order',
      },
    ],
  },
] as const satisfies readonly DiscoverCollectionDefinition[]

/*
 * ──────────────────────────────────────────────
 * Derived registry types
 * ──────────────────────────────────────────────
 */

export type DiscoverCollection = (typeof DISCOVER_COLLECTIONS)[number]

export type DiscoverCollectionId = DiscoverCollection['id']

const DISCOVER_COLLECTION_IDS = new Set<string>(
  DISCOVER_COLLECTIONS.map((collection) => collection.id)
)

export function isDiscoverCollectionId(value: string): value is DiscoverCollectionId {
  return DISCOVER_COLLECTION_IDS.has(value)
}

export function parseDiscoverCollection(value: string | null): DiscoverCollection | null {
  if (!value || !isDiscoverCollectionId(value)) {
    return null
  }

  return DISCOVER_COLLECTIONS.find((collection) => collection.id === value) ?? null
}

export function getDiscoverCollection(id: DiscoverCollectionId): DiscoverCollection {
  const collection = DISCOVER_COLLECTIONS.find((item) => item.id === id)

  if (!collection) {
    throw new Error(`Unknown discover collection: ${id}`)
  }

  return collection
}

/*
 * Dynamic collections do not have a reliable title
 * count before resolution.
 *
 * This helper therefore returns only the number of
 * statically known refs. Do not display it as the
 * collection's final title count.
 */
export function getDiscoverCollectionTitleCount(collection: DiscoverCollection): number {
  const refs = new Set<string>()

  function add(item: DiscoverCollectionMediaRef) {
    refs.add(discoverCollectionMediaIdentity(item))
  }

  function addMany(items: readonly DiscoverCollectionMediaRef[] | undefined) {
    for (const item of items ?? []) {
      add(item)
    }
  }

  function visitSource(source: DiscoverCollectionSource) {
    addMany(source.include)
    addMany(source.exclude)

    switch (source.type) {
      case 'tmdb-collection':
        add(source.seed)
        break

      case 'explicit':
        addMany(source.items)
        break

      case 'composite':
        for (const child of source.sources) {
          visitSource(child)
        }
        break

      case 'tmdb-keyword':
        break
    }
  }

  visitSource(collection.source)
  add(collection.hero)

  for (const view of collection.views) {
    if (view.type === 'selection') {
      addMany(view.items)
    }

    if (view.type === 'curated-order') {
      addMany(view.order)
    }
  }

  return refs.size
}
