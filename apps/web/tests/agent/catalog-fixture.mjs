const fixtures = [
  [157336, 'movie', 'Interstellar'],
  [1001, 'movie', 'The Odyssey'],
  [1002, 'tv', 'The Odyssey'],
  [693134, 'movie', 'Dune: Part Two', 'Duna: Parte Dois'],
  [95396, 'tv', 'Severance', 'Ruptura'],
  [5920, 'tv', 'The Mentalist'],
  [329865, 'movie', 'Arrival', 'A Chegada'],
  [152601, 'movie', 'Her', 'Ela'],
  [17431, 'movie', 'Moon'],
  [264660, 'movie', 'Ex Machina'],
  [782, 'movie', 'Gattaca'],
  [206487, 'movie', 'Predestination'],
]

function item([id, type, original, localized], locale = '', year) {
  const title = locale === 'pt-BR' ? localized || original : original
  const date =
    (year || (id === 693134 ? '2024' : id === 1001 ? '2026' : id === 1002 ? '1997' : '2014')) +
    '-01-01'
  return {
    id,
    media_type: type,
    ...(type === 'movie'
      ? { title, original_title: original, release_date: date, runtime: 100 }
      : {
          name: title,
          original_name: original,
          first_air_date: date,
          seasons: [0, 1, 2].map((season_number) => ({
            season_number,
            episode_count: 6,
            air_date: '2022-01-01',
          })),
          number_of_seasons: 2,
          number_of_episodes: 12,
          episode_run_time: [55],
        }),
    poster_path: id === 1002 ? null : '/fixture.jpg',
    backdrop_path: null,
    overview: 'Catalog fixture',
    popularity: id === 1001 ? 300 : 10,
    genre_ids: [878],
    genres: [{ id: 878, name: 'Science Fiction' }],
    vote_average: 8,
    vote_count: 100,
  }
}

export function catalogFixture(url) {
  const path = url.pathname.replace('/3/', '').split('/')
  const language = url.searchParams.get('language')
  if (path.join('/') === 'search/multi') {
    const results = fixtures.filter(([, , name]) => name === url.searchParams.get('query'))
    return Response.json({ results: results.map((row) => item(row, language)), total_pages: 1 })
  }
  const row = fixtures.find(([id, type]) => type === path[0] && id === Number(path[1]))
  if (!row) return Response.json({}, { status: 404 })
  if (path[2] === 'credits') return Response.json({ cast: [], crew: [] })
  if (path[2] === 'season') {
    const season = Number(path[3])
    const episodes = Array.from({ length: 6 }, (_, index) => ({
      id: season * 100 + index + 1,
      name: `Episode ${index + 1}`,
      season_number: season,
      episode_number: index + 1,
      air_date: season === 2 || index === 5 ? '2199-01-01' : '2022-02-01',
      runtime: 55,
      still_path: '/still.jpg',
    }))
    return Response.json({ episodes })
  }
  if (path[2] === 'recommendations') {
    return Response.json({
      results: [157336, 693134, 95396, 782, 206487].flatMap((id) => {
        const candidate = fixtures.find((value) => value[0] === id && value[1] === row[1])
        return candidate ? [item(candidate, language)] : []
      }),
    })
  }
  return Response.json(item(row, language))
}
