import type { ImportMoviePayload, ImportTitleItem, ParsedImportResult } from './types'

type CsvRecord = Record<string, string>

export async function parseImportFile(file: File): Promise<ParsedImportResult> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseLetterboxdCsv(await file.text(), file.name)
  }

  return {
    source: null,
    fileName: file.name,
    items: [],
    warnings: [],
    errors: ['Unsupported file format. Upload a Letterboxd .csv export.'],
  }
}

export function parseLetterboxdCsv(
  csvText: string,
  fileName = 'letterboxd-export.csv'
): ParsedImportResult {
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

  const grouped = new Map<
    string,
    { title: string; year: number | null; watches: ImportMoviePayload[] }
  >()

  for (const record of records) {
    const title = firstValue(record, ['Name', 'Film', 'Title', 'movie_name', 'name'])?.trim()
    if (!title) {
      warnings.push('Skipped a Letterboxd row without a title.')
      continue
    }
    const year = parseYear(firstValue(record, ['Year', 'year']))
    const watchedAt = parseDateString(
      firstValue(record, ['Watched Date', 'Watched At', 'Date', 'watched_at']) ||
        new Date().toISOString()
    )
    const rating = normalizeRating(firstValue(record, ['Rating', 'rating']))
    const rewatch = parseBooleanLike(
      firstValue(record, ['Rewatch', 'rewatch', 'Rewatch?', 'rewatched'])
    )
    const key = normalizeGroupingKey(title, year)
    const payload: ImportMoviePayload = {
      watchedAt,
      rating,
      watchType: rewatch ? 'rewatch' : 'first-time',
    }
    const existing = grouped.get(key)
    if (existing) existing.watches.push(payload)
    else grouped.set(key, { title, year, watches: [payload] })
  }

  const items = Array.from(grouped.entries()).map(([key, value]) => {
    const latestWatch = [...value.watches].sort(
      (left, right) => Date.parse(right.watchedAt) - Date.parse(left.watchedAt)
    )[0]
    const count = value.watches.length
    return buildImportItem({
      id: `letterboxd-${key}`,
      source: 'letterboxd',
      mediaType: 'movie',
      title: value.title,
      year: value.year,
      watchedAt: latestWatch?.watchedAt || new Date().toISOString(),
      rating: chooseRating(value.watches.map((watch) => watch.rating).filter(isNumberLike)),
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

function buildImportItem(input: Omit<ImportTitleItem, 'include'>): ImportTitleItem {
  return { ...input, issue: input.issue?.trim() || null, include: true }
}

function parseCsv(text: string): CsvRecord[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!normalized.trim()) return []
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (quoted && char === '"' && normalized[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (char === '"') quoted = !quoted
    else if (!quoted && (char === ',' || char === '\n')) {
      row.push(value)
      value = ''
      if (char === '\n') {
        rows.push(row)
        row = []
      }
    } else value += char
  }
  row.push(value)
  rows.push(row)
  const headers = rows.shift()?.map((header) => header.trim()) || []
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').trim()]))
    )
}

function firstValue(record: CsvRecord, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase()
    )
    if (match && record[match]?.trim()) return record[match]
  }
  return null
}

function parseDateString(value: string) {
  const parsed = new Date(
    value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T')
  )
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function parseYear(value: string | null) {
  if (!value) return null
  const year = Number.parseInt(value, 10)
  return Number.isFinite(year) ? year : null
}

function parseBooleanLike(value: string | null) {
  return Boolean(value && ['1', 'true', 'yes', 'y', 'rewatch'].includes(value.trim().toLowerCase()))
}

function normalizeRating(value: string | null) {
  if (!value) return null
  const rating = Number.parseFloat(value)
  if (!Number.isFinite(rating)) return null
  return rating > 5 ? Math.min(5, rating / 2) : rating
}

function chooseRating(values: number[]) {
  return values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
    : null
}

function isNumberLike(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeGroupingKey(title: string, year?: number | null) {
  return `${title.trim().toLowerCase().replace(/\s+/g, '-')}-${year || 'unknown'}`
}
