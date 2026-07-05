import JSZip from 'jszip'
import type {
  ImportEpisodePayload,
  ImportMoviePayload,
  ImportTitleItem,
  ImportSource,
  ParsedImportResult,
} from '~/types/imports'
import type { WatchType } from '~/types/common'

type CsvRecord = Record<string, string>

interface RawEpisodeWatch {
  seriesName: string
  seasonNumber: number
  episodeNumber: number
  watchedAt: string
  watchType: WatchType
  rating: number | null
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

export async function parseImportFileFromUri(
  fileName: string,
  uri: string,
  readText: (uri: string) => Promise<string>,
  readBase64: (uri: string) => Promise<string>
): Promise<ParsedImportResult> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith('.zip')) {
    const base64 = await readBase64(uri)
    return parseTvTimeZip(base64, fileName)
  }

  if (lower.endsWith('.csv')) {
    const text = await readText(uri)
    return parseLetterboxdCsv(text, fileName)
  }

  return {
    source: null,
    fileName,
    items: [],
    warnings: [],
    errors: ['Unsupported file format. Please upload a TV Time .zip export or a Letterboxd .csv export.'],
  }
}

export async function parseTvTimeZip(base64Zip: string, fileName = 'tvtime-export.zip'): Promise<ParsedImportResult> {
  const zip = await JSZip.loadAsync(base64Zip, { base64: true })
  const fileMap: Record<string, string> = {}
  const warnings: string[] = []
  const errors: string[] = []

  const wantedFiles = Object.values(TVTIME_FILENAMES)
  await Promise.all(
    wantedFiles.map(async (wanted) => {
      const entry = findZipEntry(zip, wanted)
      if (!entry) {
        warnings.push(`TV Time export is missing ${wanted}; some items may not import.`)
        return
      }
      fileMap[wanted] = await entry.async('string')
    })
  )

  const items = buildTvTimeItems(fileMap, warnings)

  if (items.length === 0) {
    errors.push('No TV Time history records were found in the archive.')
  }

  return {
    source: 'tvtime',
    fileName,
    items,
    warnings,
    errors,
  }
}

export function parseLetterboxdCsv(csvText: string, fileName = 'letterboxd-export.csv'): ParsedImportResult {
  const records = parseCsv(csvText)
  const warnings: string[] = []
  const errors: string[] = []

  if (records.length === 0) {
    return {
      source: 'letterboxd',
      fileName,
      items: [],
      warnings,
      errors: ['The Letterboxd export is empty.'],
    }
  }

  const grouped = new Map<string, {
    title: string
    year: number | null
    watches: ImportMoviePayload[]
  }>()

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
    const rawRating = firstValue(record, ['Rating', 'rating'])
    const rating = normalizeRating(rawRating, 'letterboxd')
    const rewatchHint = parseBooleanLike(
      firstValue(record, ['Rewatch', 'rewatch', 'Rewatch?', 'rewatched', 'Rewatching'])
    )

    const key = normalizeGroupingKey(title, year)
    const existing = grouped.get(key)
    const payload: ImportMoviePayload = {
      watchedAt,
      rating,
      watchType: rewatchHint ? 'rewatch' : 'first-time',
    }

    if (!existing) {
      grouped.set(key, {
        title,
        year,
        watches: [payload],
      })
    } else {
      existing.watches.push(payload)
    }
  }

  const items = Array.from(grouped.entries()).map(([key, value]) => {
    const latestWatch = [...value.watches].sort(
      (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
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

  if (items.length === 0) {
    errors.push('No Letterboxd rows could be parsed.')
  }

  return {
    source: 'letterboxd',
    fileName,
    items,
    warnings,
    errors,
  }
}

function buildTvTimeItems(fileMap: Record<string, string>, warnings: string[]): ImportTitleItem[] {
  const watchedEpisodes = parseCsv(fileMap[TVTIME_FILENAMES.watchedEpisodes] || '')
  const latestEpisodes = parseCsv(fileMap[TVTIME_FILENAMES.latestEpisodes] || '')
  const movieTracks = parseCsv(fileMap[TVTIME_FILENAMES.movieTracks] || '')
  const movieRatings = parseCsv(fileMap[TVTIME_FILENAMES.movieRatings] || '')
  const episodeRatings = parseCsv(fileMap[TVTIME_FILENAMES.episodeRatings] || '')

  const movieWatchMap = new Map<string, RawMovieWatch>()
  const movieRatingMap = new Map<string, number>()
  const seriesEpisodeMap = new Map<string, RawEpisodeWatch[]>()
  const episodeRatingMap = new Map<string, number>()

  for (const record of movieTracks) {
    const title = firstValue(record, ['movie_name', 'movie name', 'title'])?.trim()
    if (!title) continue

    const key = normalizeGroupingKey(title)
    const count = parseInt(firstValue(record, ['watch_count', 'watch count']) || '1', 10) || 1
    const rewatchCount = parseInt(firstValue(record, ['rewatch_count', 'rewatch count']) || '0', 10) || 0
    const watchedAt = parseDateString(
      firstValue(record, ['followed_at', 'updated_at', 'created_at']) || new Date().toISOString()
    )
    const rating = movieRatingMap.get(key) ?? null
    const watchType: WatchType = rewatchCount > 0 || count > 1 ? 'rewatch' : 'first-time'

    const existing = movieWatchMap.get(key)
    if (!existing) {
      movieWatchMap.set(key, { title, watchedAt, watchType, rating, count })
    } else if (new Date(watchedAt).getTime() > new Date(existing.watchedAt).getTime()) {
      movieWatchMap.set(key, {
        title,
        watchedAt,
        watchType: existing.count > 1 ? 'rewatch' : watchType,
        rating,
        count: Math.max(existing.count + 1, count),
      })
    } else {
      existing.count = Math.max(existing.count + 1, count)
      existing.watchType = existing.count > 1 || rewatchCount > 0 ? 'rewatch' : existing.watchType
      if (rating !== null) existing.rating = rating
    }
  }

  for (const record of movieRatings) {
    const title = firstValue(record, ['movie_name', 'title'])?.trim()
    const voteKey = firstValue(record, ['vote_key', 'vote key'])?.trim()
    if (!title || !voteKey) continue
    const key = normalizeGroupingKey(title)
    const rating = parseTvTimeRatingFromVoteKey(voteKey)
    if (rating !== null) {
      movieRatingMap.set(key, rating)
    }
  }

  for (const movie of movieWatchMap.values()) {
    const key = normalizeGroupingKey(movie.title)
    const rating = movieRatingMap.get(key)
    if (rating !== undefined) {
      movie.rating = rating
    }
  }

  for (const record of watchedEpisodes) {
    const seriesName = firstValue(record, ['tv_show_name', 'series_name', 'tv show name', 'name'])?.trim()
    const seasonNumber = parseInt(firstValue(record, ['episode_season_number', 'season_number', 'season']) || '0', 10)
    const episodeNumber = parseInt(firstValue(record, ['episode_number', 'episode']) || '0', 10)
    if (!seriesName || !seasonNumber || !episodeNumber) continue

    const key = normalizeGroupingKey(seriesName)
    const watchedAt = parseDateString(
      firstValue(record, ['updated_at', 'created_at']) || new Date().toISOString()
    )

    const list = seriesEpisodeMap.get(key) || []
    const existing = list.find(
      (item) => item.seasonNumber === seasonNumber && item.episodeNumber === episodeNumber
    )

    if (existing) {
      if (new Date(watchedAt).getTime() > new Date(existing.watchedAt).getTime()) {
        existing.watchedAt = watchedAt
      }
      existing.watchType = 'rewatch'
    } else {
      list.push({
        seriesName,
        seasonNumber,
        episodeNumber,
        watchedAt,
        watchType: 'first-time',
        rating: null,
      })
    }

    seriesEpisodeMap.set(key, list)
  }

  for (const record of episodeRatings) {
    const seriesName = firstValue(record, ['series_name', 'tv_show_name', 'name'])?.trim()
    const seasonNumber = parseInt(firstValue(record, ['season_number', 'episode_season_number']) || '0', 10)
    const episodeNumber = parseInt(firstValue(record, ['episode_number']) || '0', 10)
    const voteKey = firstValue(record, ['vote_key'])?.trim()
    if (!seriesName || !seasonNumber || !episodeNumber || !voteKey) continue
    const key = normalizeGroupingKey(seriesName)
    const rating = parseTvTimeRatingFromVoteKey(voteKey)
    if (rating !== null) {
      episodeRatingMap.set(`${key}|${seasonNumber}|${episodeNumber}`, rating)
    }
  }

  const items: ImportTitleItem[] = []

  for (const [key, episodes] of seriesEpisodeMap.entries()) {
    const latestEpisode = [...episodes].sort(
      (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
    )[0]
    const ratings = episodes
      .map((episode) => episodeRatingMap.get(`${key}|${episode.seasonNumber}|${episode.episodeNumber}`))
      .filter(isNumberLike)
    const rating = chooseRating(ratings)
    const count = episodes.length
    const title = latestEpisode.seriesName

    items.push(
      buildImportItem({
        id: `tvtime-${key}`,
        source: 'tvtime',
        mediaType: 'tv',
        title,
        year: null,
        watchedAt: latestEpisode?.watchedAt || new Date().toISOString(),
        rating,
        watchType: episodes.some((episode) => episode.watchType === 'rewatch')
          ? 'rewatch'
          : 'first-time',
        count,
        confidence: ratings.length > 0 ? 'high' : 'medium',
        sourceLabel: 'TV Time',
        notes: `Imported ${count} episode${count === 1 ? '' : 's'} from TV Time.`,
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

    const watchedAt = parseDateString(
      firstValue(record, ['updated_at', 'created_at']) || new Date().toISOString()
    )
    warnings.push(`Filled in ${seriesName} from the latest-episode summary because detailed watches were missing.`)
    items.push(
      buildImportItem({
        id: `tvtime-${key}`,
        source: 'tvtime',
        mediaType: 'tv',
        title: seriesName,
        year: null,
        watchedAt,
        rating: null,
        watchType: 'first-time',
        count: 1,
        confidence: 'low',
        sourceLabel: 'TV Time',
        issue: 'Episode list was missing, so only the latest episode summary could be imported.',
      })
    )
  }

  if (movieWatchMap.size === 0 && items.length === 0) {
    warnings.push('No TV Time title history was found in the export.')
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

  return items.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
}

function buildImportItem(input: Omit<ImportTitleItem, 'include'>): ImportTitleItem {
  const issue = input.issue?.trim() || null
  return {
    ...input,
    issue,
    include: true,
  }
}

function findZipEntry(zip: JSZip, wantedFileName: string) {
  const normalizedWanted = wantedFileName.toLowerCase()
  const entry = Object.values(zip.files).find((file) => file.name.toLowerCase().endsWith(normalizedWanted))
  return entry || null
}

function parseCsv(text: string): CsvRecord[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return []

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]
    const nextChar = normalized[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"'
        i += 1
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

function firstValue(record: CsvRecord, keys: string[]): string | null {
  for (const key of keys) {
    const direct = record[key]
    if (direct !== undefined && direct !== null && direct.trim().length > 0) {
      return direct
    }

    const normalizedKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
    if (normalizedKey) {
      const value = record[normalizedKey]
      if (value !== undefined && value !== null && value.trim().length > 0) {
        return value
      }
    }
  }

  return null
}

function parseDateString(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return new Date().toISOString()

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

function parseYear(value: string | null): number | null {
  if (!value) return null
  const year = parseInt(value.trim(), 10)
  return Number.isFinite(year) ? year : null
}

function parseBooleanLike(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', 'y', 'rewatch'].includes(normalized)
}

function parseTvTimeRatingFromVoteKey(voteKey: string): number | null {
  const suffix = voteKey.split('-').pop()
  if (!suffix) return null

  const numeric = Number.parseInt(suffix, 10)
  if (!Number.isFinite(numeric)) return null

  if (numeric > 5) {
    return Math.min(5, numeric / 10)
  }

  return numeric
}

function normalizeRating(value: string | null, source: ImportSource): number | null {
  if (!value) return null
  const rating = Number.parseFloat(value.trim())
  if (!Number.isFinite(rating)) return null

  if (source === 'letterboxd' && rating > 5) {
    return Math.min(5, rating / 2)
  }

  return rating
}

function chooseRating(values: number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number((total / values.length).toFixed(1))
}

function isNumberLike(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeGroupingKey(title: string, year?: number | null): string {
  const normalizedTitle = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
  return `${normalizedTitle}|${year ?? ''}`
}
