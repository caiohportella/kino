type QueryClause = Record<string, unknown>
type EntityType = 'movie' | 'series' | 'person' | 'user'

function entityFilter(entityTypes: readonly EntityType[]): QueryClause {
  if (entityTypes.length === 1) return { entityType: { $eq: entityTypes[0] } }
  return {
    $should: entityTypes.map((entityType) => ({
      entityType: { $eq: entityType },
    })),
  }
}

function smart(value: string, boost?: number): QueryClause {
  return {
    $smart: value,
    ...(boost === undefined ? {} : { $boost: boost }),
  }
}

function fuzzy(value: string, boost?: number): QueryClause {
  return {
    $fuzzy: {
      value,
      prefix: true,
      transpositionCostOne: true,
    },
    ...(boost === undefined ? {} : { $boost: boost }),
  }
}

export function buildTitleQuery(
  query: string,
  options: {
    readonly autocomplete?: boolean
    readonly mediaTypes?: readonly string[]
  } = {}
): QueryClause {
  const fields = [
    'title',
    'originalTitle',
    'aliases',
    'localizedTitles.en',
    'localizedTitles.pt',
    'localizedTitles.fr',
    'localizedTitles.it',
    'localizedTitles.no',
    'localizedTitles.es',
    'localizedTitles.de',
  ]
  const clauses = fields.flatMap((field, index) => [
    {
      [field]: smart(query, index === 0 ? 1.4 : undefined),
    },
    ...(options.autocomplete
      ? [
          {
            [field]: fuzzy(query, 0.8),
          },
        ]
      : []),
  ])
  const queryFilter: QueryClause = { $should: clauses }
  const mediaTypes = options.mediaTypes?.filter(
    (mediaType): mediaType is 'movie' | 'series' => mediaType === 'movie' || mediaType === 'series'
  )
  const entityTypes: readonly EntityType[] = mediaTypes?.length ? mediaTypes : ['movie', 'series']
  return { $must: [entityFilter(entityTypes), queryFilter] }
}

export function buildPersonQuery(query: string): QueryClause {
  return {
    $must: [
      entityFilter(['person']),
      {
        $should: [{ name: smart(query, 1.5) }, { name: fuzzy(query) }, { aliases: smart(query) }],
      },
    ],
  }
}
export function buildUserQuery(query: string): QueryClause {
  const username = query.replace(/^@+/u, '')
  return {
    $must: [
      entityFilter(['user']),
      {
        $should: [
          {
            username: {
              $eq: username,
              $boost: 2,
            },
          },
          {
            username: fuzzy(username, 1.5),
          },
          { displayName: smart(query) },
          { firstName: smart(query) },
          { lastName: smart(query) },
        ],
      },
    ],
  }
}
