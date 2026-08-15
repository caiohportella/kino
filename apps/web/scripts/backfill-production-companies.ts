import { createScriptSupabaseClient, createScriptTmdbService } from './upstash/shared.ts'

const supabase = createScriptSupabaseClient()
const tmdb = createScriptTmdbService()

const PAGE_SIZE = 1000
const UPDATE_BATCH_SIZE = 25

type MediaType = 'movie' | 'tv'

type ProductionCompany = {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

type TitleRow = {
  id: string
  tmdb_id: number
  type: MediaType
  title: string
  production_companies: ProductionCompany[] | null
}

type Update = {
  id: string
  title: string
  tmdbId: number
  type: MediaType
  productionCompanies: ProductionCompany[]
}

const rows: TitleRow[] = []

for (let from = 0; ; from += PAGE_SIZE) {
  const { data, error } = await supabase
    .from('titles')
    .select('id,tmdb_id,type,title,production_companies')
    .not('tmdb_id', 'is', null)
    .order('id')
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error

  const page = (data ?? []) as TitleRow[]

  rows.push(...page)

  if (page.length < PAGE_SIZE) break
}

const missingRows = rows.filter(
  (row) =>
    row.tmdb_id > 0 &&
    (row.type === 'movie' || row.type === 'tv') &&
    (!Array.isArray(row.production_companies) || row.production_companies.length === 0)
)

console.log(`[backfill] loaded ${rows.length} titles`)
console.log(`[backfill] ${missingRows.length} titles missing production companies`)

const updates: Update[] = []

let processed = 0
let foundCompanies = 0
let withoutCompanies = 0
let failedTitles = 0

for (const row of missingRows) {
  try {
    const details =
      row.type === 'movie'
        ? await tmdb.getMovieDetails(row.tmdb_id)
        : await tmdb.getTVDetails(row.tmdb_id)

    const productionCompanies: ProductionCompany[] = (details.production_companies ?? [])
      .filter(
        (company) =>
          Number.isInteger(company.id) &&
          company.id > 0 &&
          typeof company.name === 'string' &&
          company.name.trim().length > 0
      )
      .map((company) => ({
        id: company.id,
        name: company.name,
        logo_path: company.logo_path ?? null,
        origin_country: company.origin_country ?? '',
      }))

    if (productionCompanies.length > 0) {
      foundCompanies += 1

      updates.push({
        id: row.id,
        title: row.title,
        tmdbId: row.tmdb_id,
        type: row.type,
        productionCompanies,
      })
    } else {
      withoutCompanies += 1

      console.warn('[backfill] no production companies', {
        id: row.id,
        tmdbId: row.tmdb_id,
        type: row.type,
        title: row.title,
      })
    }
  } catch (error) {
    failedTitles += 1

    console.warn('[backfill] failed TMDB title', {
      error,
      id: row.id,
      tmdbId: row.tmdb_id,
      type: row.type,
      title: row.title,
    })
  }

  processed += 1

  if (processed % 25 === 0 || processed === missingRows.length) {
    console.log(`[backfill] checked ${processed}/${missingRows.length} titles`)
  }
}

console.log(`[backfill] titles with companies found: ${foundCompanies}`)
console.log(`[backfill] titles without companies on TMDB: ${withoutCompanies}`)
console.log(`[backfill] failed titles: ${failedTitles}`)
console.log(`[backfill] ready to update ${updates.length} titles`)

const shouldApply = process.argv.includes('--apply')

if (!shouldApply) {
  console.log('[backfill] dry run only — pass --apply to write changes')
  process.exit(0)
}

for (let index = 0; index < updates.length; index += UPDATE_BATCH_SIZE) {
  const batch = updates.slice(index, index + UPDATE_BATCH_SIZE)

  await Promise.all(
    batch.map(async (update) => {
      const { error } = await supabase
        .from('titles')
        .update({
          production_companies: update.productionCompanies,
        })
        .eq('id', update.id)

      if (error) {
        console.error('[backfill] update failed', {
          error,
          id: update.id,
          tmdbId: update.tmdbId,
          type: update.type,
          title: update.title,
        })

        throw error
      }
    })
  )

  console.log(
    `[backfill] updated ${Math.min(index + UPDATE_BATCH_SIZE, updates.length)}/${updates.length}`
  )
}

console.log(`[backfill] completed ${updates.length} updates`)
