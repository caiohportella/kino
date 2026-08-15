import { normalizeTitleDocument } from '../../lib/search/upstash/title-document.ts'
import { createTitleIndexer } from '../../lib/search/upstash/title-indexer.ts'
import { createScriptSupabaseClient, readScriptUpstashConfig } from './shared.ts'

const PAGE_SIZE = 500

async function main() {
  const supabase = createScriptSupabaseClient(process.env)
  const indexer = createTitleIndexer(readScriptUpstashConfig(process.env))
  let start = 0
  let indexed = 0
  let failed = 0
  while (true) {
    const { data, error } = await supabase
      .from('titles')
      .select(
        'tmdb_id, type, title, synopsis, cover_image, backdrop_image, release_year, tmdb_data, updated_at'
      )
      .order('updated_at', { ascending: true })
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    if (rows.length === 0) break
    const documents = rows
      .map((row) => {
        const tmdbData =
          row.tmdb_data && typeof row.tmdb_data === 'object'
            ? (row.tmdb_data as Record<string, unknown>)
            : {}
        const document = normalizeTitleDocument({
          tmdbId: Number(row.tmdb_id),
          type: row.type === 'tv' ? 'tv' : 'movie',
          title: String(row.title ?? ''),
          overview: typeof row.synopsis === 'string' ? row.synopsis : null,
          year: Number(row.release_year) || null,
          posterPath: typeof row.cover_image === 'string' ? row.cover_image : null,
          backdropPath: typeof row.backdrop_image === 'string' ? row.backdrop_image : null,
          popularity: typeof tmdbData.popularity === 'number' ? tmdbData.popularity : null,
          voteAverage: typeof tmdbData.vote_average === 'number' ? tmdbData.vote_average : null,
          voteCount: typeof tmdbData.vote_count === 'number' ? tmdbData.vote_count : null,
        })
        if (!document) failed += 1
        return document
      })
      .filter((document): document is NonNullable<typeof document> => document !== null)
    await indexer.upsertDocument(documents)
    indexed += documents.length
    start += rows.length
    console.info(JSON.stringify({ indexed, failed }))
    if (rows.length < PAGE_SIZE) break
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
