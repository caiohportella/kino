import { createScriptSupabaseClient, createScriptTmdbService } from './upstash/shared.ts'

const supabase = createScriptSupabaseClient()
const tmdb = createScriptTmdbService()

const EPISODE_RUNTIME_OVERRIDES = new Map<string, number>([
  // One Tree Hill — TMDB combines S2E22 + S2E23 into one 85-minute episode.
  // IMDb lists "The Leavers Dance" (S2E23) at 42 minutes.
  ['269:2:23', 42],
])

const PAGE_SIZE = 1000

type BackfillRow = {
  id: string
  title_id: string
  season_number: number
  episode_number: number
  runtime_minutes: number | null
  titles: { tmdb_id: number } | Array<{ tmdb_id: number }> | null
}

const rows: BackfillRow[] = []

for (let from = 0; ; from += PAGE_SIZE) {
  const { data, error } = await supabase
    .from('episode_ratings')
    .select(
      `
      id,
      title_id,
      season_number,
      episode_number,
      runtime_minutes,
      titles:title_id (
        tmdb_id
      )
    `
    )
    .is('runtime_minutes', null)
    .order('id')
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error

  rows.push(...(data ?? []))

  if (!data || data.length < PAGE_SIZE) break
}

const seasonGroups = new Map<
  string,
  {
    tmdbId: number
    seasonNumber: number
    rows: typeof rows
  }
>()

for (const row of rows) {
  const joinedTitle = Array.isArray(row.titles) ? row.titles[0] : row.titles

  const tmdbId = joinedTitle?.tmdb_id
  if (!tmdbId) continue

  const key = `${tmdbId}:${row.season_number}`

  const group = seasonGroups.get(key) ?? {
    tmdbId,
    seasonNumber: row.season_number,
    rows: [],
  }

  group.rows.push(row)
  seasonGroups.set(key, group)
}

let matchedRows = 0
let missingRuntimeRows = 0
let failedSeasons = 0
let processedSeasons = 0

const updates: Array<{
  id: string
  runtimeMinutes: number
}> = []

console.log(`[backfill] ${seasonGroups.size} unique title/season combinations`)

console.log(`[backfill] loaded ${rows.length} rows missing runtime`)

for (const group of seasonGroups.values()) {
  try {
    const season = await tmdb.getSeasonDetails(group.tmdbId, group.seasonNumber)

    const runtimeByEpisode = new Map(
      season.episodes.map((episode) => [episode.episode_number, episode.runtime])
    )

    for (const row of group.rows) {
      const overrideKey = `${group.tmdbId}:${row.season_number}:${row.episode_number}`

      const runtime =
        runtimeByEpisode.get(row.episode_number) ?? EPISODE_RUNTIME_OVERRIDES.get(overrideKey)

      if (runtime != null && runtime > 0) {
        matchedRows += 1

        updates.push({
          id: row.id,
          runtimeMinutes: runtime,
        })
      } else {
        missingRuntimeRows += 1

        console.warn('[backfill] missing runtime', {
          rowId: row.id,
          tmdbId: group.tmdbId,
          seasonNumber: row.season_number,
          episodeNumber: row.episode_number,
        })
      }
    }
  } catch (error) {
    failedSeasons += 1
    missingRuntimeRows += group.rows.length

    console.warn(`[backfill] failed TMDB ${group.tmdbId} season ${group.seasonNumber}`, error)
  }

  processedSeasons += 1

  if (processedSeasons % 20 === 0) {
    console.log(`[backfill] checked ${processedSeasons}/${seasonGroups.size} seasons`)
  }
}

console.log(`[backfill] exact runtimes found: ${matchedRows}`)
console.log(`[backfill] rows without runtime: ${missingRuntimeRows}`)
console.log(`[backfill] failed seasons: ${failedSeasons}`)
console.log(`[backfill] ready to update ${updates.length} rows`)

const shouldApply = process.argv.includes('--apply')

if (!shouldApply) {
  console.log('[backfill] dry run only — pass --apply to write changes')
  process.exit(0)
}

const UPDATE_BATCH_SIZE = 25

for (let index = 0; index < updates.length; index += UPDATE_BATCH_SIZE) {
  const batch = updates.slice(index, index + UPDATE_BATCH_SIZE)

  await Promise.all(
    batch.map(async (update) => {
      const { error } = await supabase
        .from('episode_ratings')
        .update({
          runtime_minutes: update.runtimeMinutes,
        })
        .eq('id', update.id)

      if (error) throw error
    })
  )

  console.log(
    `[backfill] updated ${Math.min(index + UPDATE_BATCH_SIZE, updates.length)}/${updates.length}`
  )
}

console.log(`[backfill] completed ${updates.length} updates`)
