import JSZip from 'jszip'
import type {
  ImportMoviePayload,
  ImportSource,
  ImportTitleItem,
  ParsedImportResult,
  WatchType,
} from './types'

type CsvRecord = Record<string, string>

interface RawEpisodeWatch {
  seriesName: string
  seasonNumber: number
  episodeNumber: number
  watchedAt: string
  watchType: WatchType
}

interface RawMovieWatch {
  title: string
  watchedAt: string
  watchType: WatchType
  rating: number | null
  count: number
}

const TVTIME_FILENAMES = {
  watchedEpisodes: 'watched_on_episode.csv',
  latestEpisodes: 'show_seen_episode_latest.csv',
  movieTracks: 'tracking-prod-records.csv',
  movieRatings: 'ratings-live-votes.csv',
  episodeRatings: 'ratings-3-prod-episode_votes.csv',
} as const

export async function parseImportFile(file: File): Promise<ParsedImportResult> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.zip')) {
    const buffer = await file.arrayBuffer()
    return parseTvTimeZip(buffer, file.name)
  }

  if (lower.endsWith('.csv')) {
    return parseLetterboxdCsv(await file.text(), file.name)
  }

  return {
    source: null,
    fileName: file.name,
    items: [],
    warnings: [],
    errors: ['Unsupported file format. Upload a TV Time .zip export or a Letterboxd .csv export.'],
  }
}

export async function parseTvTimeZip(zipInput: ArrayBuffer, fileName = 'tvtime-export.zip') {
  const zip = await JSZip.loadAsync(zipInput)
  const fileMap: Record<string, string> = {}
  const warnings: string[] = []
  const errors: string[] = []

  await Promise.all(
    Object.values(TVTIME_FILENAMES).map(async (wanted) => {
      const entry = Object.values(zip.files).find((file) => file.name.toLowerCase().endsWith(wanted))
      if (!entry) {
        warnings.push(`TV Time export is missing ${wanted}; some items may not import.`)
        return
      }
      fileMap[wanted] = await entry.async('string')
    })
  )

  const items = buildTvTimeItems(fileMap, warnings)
  if (items.length === 0) errors.push('No TV Time history records were found in the archive.')

  return {
    source: 'tvtime' as const,
    fileName,
    items,
    warnings,
    errors,
  }
}

export function parseLetterboxdCsv(csvText: string, fileName = 'letterboxd-export.csv'): ParsedImportResult {
  const records = parseCsv(csvText)
  const warnings: string[] = []

  if (records.length === 0) {
    return {
      source: 'letterboxd',
      fileName,
      items: [],
      warnings,
      errors: ['The Letterboxd export is empty.'],
    }
  }

  const grouped = new Map<string, { title: string; year: number | null; watches: ImportMoviePayload[] }>()

  for (const record of records) {
    const title = firstValue(record, ['Name', 'Film', 'Title', 'movie_name', 'name'])?.trim()
    if (!title) {
      warnings.push('Skipped a Letterboxd row without a title.')
      continue
    }

    const year = parseYear(firstValue(record, ['Year', 'year']))
    const watchedAt = parseDateString(
      firstValue(record, ['Watched Date', 'Watched At', 'Date', 'watched_at', 'watched date']) ||
        new Date().toISOString()
    )
    const rating = normalizeRating(firstValue(record, ['Rating', 'rating']), 'letterboxd')
    const rewatch = parseBooleanLike(
      firstValue(record, ['Rewatch', 'rewatch', 'Rewatch?', 'rewatched', 'Rewatching'])
    )
    const key = normalizeGroupingKey(title, year)
    const existing = grouped.get(key)
    const payload = {
      watchedAt,
      rating,
      watchType: rewatch ? ('rewatch' as const) : ('first-time' as const),
    }

    if (existing) {
      existing.watches.push(payload)
    } else {
      grouped.set(key, { title, year, watches: [payload] })
    }
  }

  const items = Array.from(grouped.entries()).map(([key, value]) => {
    const latestWatch = [...value.watches].sort(
      (left, right) => new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime()
    )[0]
    const rating = chooseRating(value.watches.map((watch) => watch.rating).filter(isNumberLike))
    const count = value.watches.length

    return buildImportItem({
      id: `letterboxd-${key}`,
      source: 'letterboxd',
      mediaType: 'movie',
      title: value.title,
      year: value.year,
      watchedAt: latestWatch?.watchedAt || new Date().toISOString(),
      rating,
      watchType: count > 1 ? 'rewatch' : latestWatch?.watchType || 'first-time',
      count,
      confidence: value.year ? 'high' : 'medium',
      sourceLabel: 'Letterboxd',
      notes: count > 1 ? `Imported ${count} watches from Letterboxd.` : 'Imported from Letterboxd.',
      movieWatches: value.watches,
    })
  })

  return {
    source: 'letterboxd',
    fileName,
    items,
    warnings,
    errors: items.length === 0 ? ['No Letterboxd rows could be parsed.'] : [],
  }
}

function buildTvTimeItems(fileMap: Record<string, string>, warnings: string[]) {
  const watchedEpisodes = parseCsv(fileMap[TVTIME_FILENAMES.watchedEpisodes] || '')
  const latestEpisodes = parseCsv(fileMap[TVTIME_FILENAMES.latestEpisodes] || '')
  const movieTracks = parseCsv(fileMap[TVTIME_FILENAMES.movieTracks] || '')
  const movieRatings = parseCsv(fileMap[TVTIME_FILENAMES.movieRatings] || '')
  const episodeRatings = parseCsv(fileMap[TVTIME_FILENAMES.episodeRatings] || '')

  const movieWatchMap = new Map<string, RawMovieWatch>()
  const movieRatingMap = new Map<string, number>()
  const seriesEpisodeMap = new Map<string, RawEpisodeWatch[]>()
  const episodeRatingMap = new Map<string, number>()

  for (const record of movieRatings) {
    const title = firstValue(record, ['movie_name', 'title'])?.trim()
    const voteKey = firstValue(record, ['vote_key', 'vote key'])?.trim()
    if (!title || !voteKey) continue
    const rating = parseTvTimeRatingFromVoteKey(voteKey)
    if (rating !== null) movieRatingMap.set(normalizeGroupingKey(title), rating)
  }

  for (const record of movieTracks) {
    const title = firstValue(record, ['movie_name', 'movie name', 'title'])?.trim()
    if (!title) continue
    const key = normalizeGroupingKey(title)
    const count = Number.parseInt(firstValue(record, ['watch_count', 'watch count']) || '1', 10) || 1
    const rewatchCount =
      Number.parseInt(firstValue(record, ['rewatch_count', 'rewatch count']) || '0', 10) || 0
    const watchedAt = parseDateString(
      firstValue(record, ['followed_at', 'updated_at', 'created_at']) || new Date().toISOString()
    )
    const rating = movieRatingMap.get(key) ?? null
    const watchType: WatchType = rewatchCount > 0 || count > 1 ? 'rewatch' : 'first-time'
    const existing = movieWatchMap.get(key)

    if (!existing || new Date(watchedAt) > new Date(existing.watchedAt)) {
      movieWatchMap.set(key, {
        title,
        watchedAt,
        watchType: existing && existing.count > 1 ? 'rewatch' : watchType,
        rating,
        count: existing ? Math.max(existing.count + 1, count) : count,
      })
    } else {
      existing.count = Math.max(existing.count + 1, count)
      existing.watchType = existing.count > 1 || rewatchCount > 0 ? 'rewatch' : existing.watchType
      if (rating !== null) existing.rating = rating
    }
  }

  for (const record of watchedEpisodes) {
    const seriesName = firstValue(record, ['tv_show_name', 'series_name', 'tv show name', 'name'])?.trim()
    const seasonNumber =
      Number.parseInt(firstValue(record, ['episode_season_number', 'season_number', 'season']) || '0', 10) || 0
    const episodeNumber = Number.parseInt(firstValue(record, ['episode_number', 'episode']) || '0', 10) || 0
    if (!seriesName || !seasonNumber || !episodeNumber) continue

    const key = normalizeGroupingKey(seriesName)
    const watchedAt = parseDateString(
      firstValue(record, ['updated_at', 'created_at']) || new Date().toISOString()
    )
    const episodes = seriesEpisodeMap.get(key) || []
    const existing = episodes.find(
      (episode) => episode.seasonNumber === seasonNumber && episode.episodeNumber === episodeNumber
    )

    if (existing) {
      if (new Date(watchedAt) > new Date(existing.watchedAt)) existing.watchedAt = watchedAt
      existing.watchType = 'rewatch'
    } else {
      episodes.push({ seriesName, seasonNumber, episodeNumber, watchedAt, watchType: 'first-time' })
    }

    seriesEpisodeMap.set(key, episodes)
  }

  for (const record of episodeRatings) {
    const seriesName = firstValue(record, ['series_name', 'tv_show_name', 'name'])?.trim()
    const seasonNumber =
      Number.parseInt(firstValue(record, ['season_number', 'episode_season_number']) || '0', 10) || 0
    const episodeNumber = Number.parseInt(firstValue(record, ['episode_number']) || '0', 10) || 0
    const voteKey = firstValue(record, ['vote_key'])?.trim()
    if (!seriesName || !seasonNumber || !episodeNumber || !voteKey) continue
    const rating = parseTvTimeRatingFromVoteKey(voteKey)
    if (rating !== null) episodeRatingMap.set(`${normalizeGroupingKey(seriesName)}|${seasonNumber}|${episodeNumber}`, rating)
  }

  const items: ImportTitleItem[] = []

  for (const [key, episodes] of seriesEpisodeMap.entries()) {
    const latestEpisode = [...episodes].sort(
      (left, right) => new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime()
    )[0]
    if (!latestEpisode) continue
    const ratings = episodes
      .map((episode) => episodeRatingMap.get(`${key}|${episode.seasonNumber}|${episode.episodeNumber}`))
      .filter(isNumberLike)
    const rating = chooseRating(ratings)

    items.push(
      buildImportItem({
        id: `tvtime-${key}`,
        source: 'tvtime',
        mediaType: 'tv',
        title: latestEpisode.seriesName,
        year: null,
        watchedAt: latestEpisode.watchedAt,
        rating,
        watchType: episodes.some((episode) => episode.watchType === 'rewatch') ? 'rewatch' : 'first-time',
        count: episodes.length,
        confidence: ratings.length > 0 ? 'high' : 'medium',
        sourceLabel: 'TV Time',
        notes: `Imported ${episodes.length} episode${episodes.length === 1 ? '' : 's'} from TV Time.`,
        tvEpisodes: episodes.map((episode) => ({
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          watchedAt: episode.watchedAt,
          rating: episodeRatingMap.get(`${key}|${episode.seasonNumber}|${episode.episodeNumber}`) ?? null,
          watchType: episode.watchType,
        })),
      })
    )
  }

  for (const record of latestEpisodes) {
    const seriesName = firstValue(record, ['tv_show_name', 'name'])?.trim()
    if (!seriesName) continue
    const key = normalizeGroupingKey(seriesName)
    if (seriesEpisodeMap.has(key)) continue
    warnings.push(`Filled in ${seriesName} from the latest-episode summary because detailed watches were missing.`)
    items.push(
      buildImportItem({
        id: `tvtime-${key}`,
        source: 'tvtime',
        mediaType: 'tv',
        title: seriesName,
        year: null,
        watchedAt: parseDateString(firstValue(record, ['updated_at', 'created_at']) || new Date().toISOString()),
        rating: null,
        watchType: 'first-time',
        count: 1,
        confidence: 'low',
        sourceLabel: 'TV Time',
        issue: 'Episode list was missing, so only the latest episode summary could be imported.',
      })
    )
  }

  for (const movie of movieWatchMap.values()) {
    items.push(
      buildImportItem({
        id: `tvtime-movie-${normalizeGroupingKey(movie.title)}`,
        source: 'tvtime',
        mediaType: 'movie',
        title: movie.title,
        year: null,
        watchedAt: movie.watchedAt,
        rating: movie.rating,
        watchType: movie.watchType,
        count: movie.count,
        confidence: movie.rating !== null ? 'high' : 'medium',
        sourceLabel: 'TV Time',
        notes: `Imported ${movie.count} movie watch${movie.count === 1 ? '' : 'es'} from TV Time.`,
        movieWatches: [{ watchedAt: movie.watchedAt, rating: movie.rating, watchType: movie.watchType }],
      })
    )
  }

  if (movieWatchMap.size === 0 && items.length === 0) {
    warnings.push('No TV Time title history was found in the export.')
  }

  return items.sort((left, right) => new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime())
}

function buildImportItem(input: Omit<ImportTitleItem, 'include'>): ImportTitleItem {
  return { ...input, issue: input.issue?.trim() || null, include: true }
}

function parseCsv(text: string): CsvRecord[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return []

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const nextChar = normalized[index + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentValue += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }
    if (char === '\n') {
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ''
      continue
    }
    currentValue += char
  }

  currentRow.push(currentValue)
  rows.push(currentRow)

  const headers = rows.shift()?.map((header) => header.trim()) || []
  return rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const record: CsvRecord = {}
      headers.forEach((header, index) => {
        record[header] = (row[index] || '').trim()
      })
      return record
    })
}

function firstValue(record: CsvRecord, keys: string[]) {
  for (const key of keys) {
    const direct = record[key]
    if (direct?.trim()) return direct
    const normalizedKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
    const normalized = normalizedKey ? record[normalizedKey] : null
    if (normalized?.trim()) return normalized
  }
  return null
}

function parseDateString(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return new Date().toISOString()
  const parsed = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function parseYear(value: string | null) {
  if (!value) return null
  const year = Number.parseInt(value.trim(), 10)
  return Number.isFinite(year) ? year : null
}

function parseBooleanLike(value: string | null) {
  if (!value) return false
  return ['1', 'true', 'yes', 'y', 'rewatch'].includes(value.trim().toLowerCase())
}

function parseTvTimeRatingFromVoteKey(voteKey: string) {
  const suffix = voteKey.split('-').pop()
  if (!suffix) return null
  const numeric = Number.parseInt(suffix, 10)
  if (!Number.isFinite(numeric)) return null
  return numeric > 5 ? Math.min(5, numeric / 10) : numeric
}

function normalizeRating(value: string | null, source: ImportSource) {
  if (!value) return null
  const rating = Number.parseFloat(value.trim())
  if (!Number.isFinite(rating)) return null
  return source === 'letterboxd' && rating > 5 ? Math.min(5, rating / 2) : rating
}

function chooseRating(values: number[]) {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

function isNumberLike(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeGroupingKey(title: string, year?: number | null) {
  const normalizedTitle = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
  return `${normalizedTitle}|${year ?? ''}`
}
