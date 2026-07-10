'use client'

import type { ImportTitleItem, MediaType, TMDbTitle } from '@kino/core'
import {
  chooseBestSearchCandidate,
  parseImportFile,
  transformMovieToTitleDetails,
  transformTVToTitleDetails,
} from '@kino/core'
import { Button, Card, EmptyState, Field, ProgressBar, SegmentedControl, TextArea } from '@kino/ui'
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Loader2,
  RotateCcw,
  Save,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppPagination } from '@/components/app-pagination'
import { PageHeader } from '@/components/page-header'
import { ProtectedEmpty } from '@/components/protected-empty'
import { db, getTmdb } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

type ImportState = {
  fileName: string
  items: ImportTitleItem[]
  warnings: string[]
  errors: string[]
}

type ImportProgress = {
  completed: number
  total: number
  imported: number
  skipped: number
  failed: number
}

type ImportSummary = Pick<ImportProgress, 'imported' | 'skipped' | 'failed'>

const emptyState: ImportState = {
  fileName: '',
  items: [],
  warnings: [],
  errors: [],
}

export default function ImportPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [state, setState] = useState<ImportState>(emptyState)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress>({
    completed: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
  })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  if (!user) {
    return (
      <ProtectedEmpty
        body="Imports write into your Kino account after local review."
        title="Sign in to import history"
      />
    )
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setLoading(true)
    setError(null)
    setImportSummary(null)
    setProgress({ completed: 0, total: 0, imported: 0, skipped: 0, failed: 0 })
    try {
      const parsed = await parseImportFile(file)
      setState({
        fileName: parsed.fileName,
        items: parsed.items,
        warnings: parsed.warnings,
        errors: parsed.errors,
      })
      setPage(1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not parse that file.')
    } finally {
      setLoading(false)
    }
  }

  function updateItem(id: string, updates: Partial<ImportTitleItem>) {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }))
  }

  async function handleImport() {
    const included = state.items.filter((item) => item.include)
    if (included.length === 0) {
      setError('Choose at least one item to import.')
      return
    }

    setImporting(true)
    setError(null)
    setImportSummary(null)
    setProgress({ completed: 0, total: included.length, imported: 0, skipped: 0, failed: 0 })

    let importedCount = 0
    let skippedCount = 0
    let failureCount = 0

    // Reset status of all items
    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.include ? { ...item, importStatus: 'idle', importError: undefined } : item
      ),
    }))

    try {
      for (let index = 0; index < included.length; index += 1) {
        const item = included[index]
        if (!item) continue

        updateItem(item.id, { importStatus: 'processing' })

        try {
          const resolvedTitle = await resolveTitleId(item, (id, newMediaType) => {
            updateItem(id, { mediaType: newMediaType })
          })
          if (!resolvedTitle) throw new Error(`Could not find "${item.title}" in TMDB.`)

          const existingDiaryEntry = await db.getLastWatchEntry(resolvedTitle.titleId)
          if (existingDiaryEntry) {
            updateItem(item.id, {
              importStatus: 'skipped',
              importError: 'Already exists in your diary.',
            })
            skippedCount += 1
          } else if (
            resolvedTitle.mediaType === 'movie' ||
            !item.tvEpisodes ||
            item.tvEpisodes.length === 0
          ) {
            if (item.rating === null) throw new Error(`"${item.title}" needs a rating.`)
            const watchedAt = new Date(item.watchedAt)
            await db.rateTitle(
              resolvedTitle.titleId,
              item.rating,
              item.watchType,
              watchedAt,
              item.notes
            )
            await db.addWatchDiaryEntry(
              resolvedTitle.titleId,
              watchedAt,
              item.watchType,
              item.notes
            )
            updateItem(item.id, { importStatus: 'success', importError: undefined })
            importedCount += 1
          } else {
            const episodes = item.tvEpisodes || []
            for (const episode of episodes) {
              const rating = episode.rating ?? item.rating
              if (rating === null) throw new Error(`"${item.title}" needs ratings before import.`)
              await db.rateEpisode(
                resolvedTitle.titleId,
                episode.seasonNumber,
                episode.episodeNumber,
                rating,
                episode.watchType,
                new Date(episode.watchedAt),
                item.notes
              )
            }
            await db.addWatchDiaryEntry(
              resolvedTitle.titleId,
              new Date(item.watchedAt),
              item.watchType,
              item.notes
            )
            updateItem(item.id, { importStatus: 'success', importError: undefined })
            importedCount += 1
          }
        } catch (caught) {
          console.error(`[Import] Web item import failed for: ${item.title}`, caught)
          const errorMsg = caught instanceof Error ? caught.message : 'Import failed'
          updateItem(item.id, { importStatus: 'failed', importError: errorMsg })
          failureCount += 1
        }

        setProgress({
          completed: index + 1,
          total: included.length,
          imported: importedCount,
          skipped: skippedCount,
          failed: failureCount,
        })
      }

      setImportSummary({ imported: importedCount, skipped: skippedCount, failed: failureCount })
      setError(failureCount > 0 ? `${failureCount} item(s) failed to import.` : null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const includedCount = state.items.filter((item) => item.include).length
  const ITEMS_PER_PAGE = 20
  const totalPages = Math.max(1, Math.ceil(state.items.length / ITEMS_PER_PAGE))
  const paginatedItems = state.items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="content-frame">
      <PageHeader
        body="Kino parses files locally in the browser, lets you review the mapped rows, then writes only selected items into your account."
        eyebrow="Import"
        title="Bring your watch history"
      />

      <Card className="mb-6 grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-kino-text">TV Time ZIP or Letterboxd CSV</h2>
          <p className="mt-2 text-sm leading-6 text-kino-muted">
            Choose an export file. You can edit titles, dates, ratings, and inclusion before saving.
          </p>
          {state.fileName ? (
            <p className="mt-2 text-sm font-semibold text-kino-accent">{state.fileName}</p>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-kino-accent px-4 py-3 text-sm font-semibold text-black">
          <CloudUpload size={16} />
          {loading ? 'Parsing...' : 'Choose file'}
          <input
            accept=".zip,.csv,text/csv,application/zip"
            className="sr-only"
            disabled={loading || importing}
            onChange={(event) => handleFile(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
      </Card>

      {state.errors.map((item) => (
        <p
          className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          key={item}
        >
          {item}
        </p>
      ))}
      {state.warnings.map((item) => (
        <p
          className="mb-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100"
          key={item}
        >
          {item}
        </p>
      ))}
      {error ? (
        <p className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {importing ? (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-kino-text">
            Importing {progress.completed} of {progress.total}
          </div>
          <ProgressBar value={progress.total ? (progress.completed / progress.total) * 100 : 0} />
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-kino-muted">
            <span>Imported: {progress.imported}</span>
            <span>Skipped: {progress.skipped}</span>
            <span>Failed: {progress.failed}</span>
          </div>
        </Card>
      ) : null}

      {importSummary ? (
        <Card className="mb-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-kino-text">Import finished</h2>
              <p className="mt-2 text-sm leading-6 text-kino-muted">
                Imported: {importSummary.imported} | Skipped: {importSummary.skipped} | Failed:{' '}
                {importSummary.failed}
              </p>
            </div>
            <Button onClick={() => router.push('/diary')} tone="secondary">
              View diary
            </Button>
          </div>
        </Card>
      ) : null}

      {state.items.length === 0 ? (
        <EmptyState
          body="Choose an export file above to preview the mapped titles."
          title="No file selected"
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-kino-muted">
              {includedCount} of {state.items.length} items selected
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setState(emptyState)
                  setPage(1)
                  setError(null)
                  setImportSummary(null)
                  setProgress({ completed: 0, total: 0, imported: 0, skipped: 0, failed: 0 })
                }}
                tone="secondary"
              >
                <RotateCcw size={16} />
                Reset
              </Button>
              <Button disabled={importing || includedCount === 0} onClick={handleImport}>
                <Save size={16} />
                Import selected
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {paginatedItems.map((item) => (
              <ImportRow item={item} key={item.id} onChange={updateItem} />
            ))}
          </div>

          <AppPagination
            label="Import results pages"
            onPageChange={setPage}
            page={page}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  )
}

function ImportRow({
  item,
  onChange,
}: {
  item: ImportTitleItem
  onChange: (id: string, updates: Partial<ImportTitleItem>) => void
}) {
  let cardBorderColor = ''
  let cardBgColor = item.include ? '' : 'opacity-60'

  if (item.importStatus === 'success') {
    cardBorderColor = 'border-green-500/40 bg-green-500/5'
  } else if (item.importStatus === 'skipped') {
    cardBorderColor = 'border-orange-500/40 bg-orange-500/5'
  } else if (item.importStatus === 'failed') {
    cardBorderColor = 'border-red-500/40 bg-red-500/5'
  }

  const isLocked =
    item.importStatus === 'success' ||
    item.importStatus === 'skipped' ||
    item.importStatus === 'processing'

  return (
    <Card className={`grid gap-4 p-4 ${cardBorderColor} ${cardBgColor}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-kino-text">{item.title}</h2>
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs font-semibold text-kino-muted">
              {item.mediaType === 'movie' ? 'Movie' : 'Series'}
            </span>
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs font-semibold text-kino-muted">
              {item.sourceLabel}
            </span>
            {item.importStatus === 'success' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
                <CheckCircle2 size={14} /> Imported
              </span>
            )}
            {item.importStatus === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                <XCircle size={14} /> Failed
              </span>
            )}
            {item.importStatus === 'skipped' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-300">
                <AlertTriangle size={14} /> Skipped (Already exists)
              </span>
            )}
            {item.importStatus === 'processing' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-kino-accent">
                <Loader2 size={14} className="animate-spin" /> Processing
              </span>
            )}
          </div>
          {item.importStatus === 'failed' ? (
            <p className="mt-2 text-sm text-red-300 font-medium">
              {item.importError || `Could not find "${item.title}" in TMDB.`}
            </p>
          ) : item.importStatus === 'skipped' ? (
            <p className="mt-2 text-sm font-medium text-orange-200">
              {item.importError || 'Already exists in your diary.'}
            </p>
          ) : item.issue ? (
            <p className="mt-2 text-sm text-orange-200">{item.issue}</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-kino-muted">
          {item.importStatus === 'success' ? (
            <CheckCircle2 size={16} className="text-green-400" />
          ) : item.importStatus === 'skipped' ? (
            <AlertTriangle size={16} className="text-orange-300" />
          ) : item.importStatus === 'failed' ? (
            <XCircle size={16} className="text-red-400" />
          ) : item.importStatus === 'processing' ? (
            <Loader2 size={16} className="animate-spin text-kino-accent" />
          ) : (
            <input
              checked={item.include}
              onChange={(event) => onChange(item.id, { include: event.target.checked })}
              type="checkbox"
            />
          )}
          {item.importStatus === 'success'
            ? 'Saved'
            : item.importStatus === 'skipped'
              ? 'Skipped'
              : 'Include'}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_160px_160px]">
        <Field
          label="Title"
          onChange={(event) => onChange(item.id, { title: event.target.value })}
          value={item.title}
          disabled={isLocked}
        />
        <Field
          label="Watched date"
          onChange={(event) =>
            onChange(item.id, { watchedAt: new Date(event.target.value).toISOString() })
          }
          type="date"
          value={item.watchedAt.slice(0, 10)}
          disabled={isLocked}
        />
        <Field
          label="Rating"
          max={5}
          min={0}
          onChange={(event) =>
            onChange(item.id, { rating: event.target.value ? Number(event.target.value) : null })
          }
          step={0.5}
          type="number"
          value={item.rating ?? ''}
          disabled={isLocked}
        />
      </div>

      <SegmentedControl
        onChange={(watchType) => {
          if (!isLocked) {
            onChange(item.id, { watchType })
          }
        }}
        options={[
          { label: 'First time', value: 'first-time' },
          { label: 'Rewatch', value: 'rewatch' },
        ]}
        value={item.watchType}
      />

      <TextArea
        label="Notes"
        onChange={(event) => onChange(item.id, { notes: event.target.value })}
        value={item.notes || ''}
        disabled={isLocked}
      />
    </Card>
  )
}

function cleanSearchTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ') // remove parentheses like (2020)
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // remove special chars
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim()
}

function stripLeadingArticles(title: string): string {
  return title.replace(/^(the|a|an|la|le|el|os|as|o|a)\s+/i, '').trim()
}

async function resolveTitleId(
  item: ImportTitleItem,
  onMediaTypeChange: (id: string, newMediaType: 'movie' | 'tv') => void
) {
  const tmdb = getTmdb()

  const searchAndMatch = async (
    query: string,
    mediaType: 'movie' | 'tv'
  ): Promise<{ id: number; mediaType: 'movie' | 'tv' } | null> => {
    try {
      const searchResult = await tmdb.search(query)
      if (!searchResult || !searchResult.results) return null

      // 1. Try primary media type
      const primaryCandidates = searchResult.results.filter(
        (result) => result.media_type === mediaType
      ) as TMDbTitle[]
      let chosen = chooseBestSearchCandidate(item.title, item.year, primaryCandidates)
      if (chosen) return { id: chosen.id, mediaType }

      // 2. Try opposite media type
      const oppositeMediaType: 'movie' | 'tv' = mediaType === 'movie' ? 'tv' : 'movie'
      const oppositeCandidates = searchResult.results.filter(
        (result) => result.media_type === oppositeMediaType
      ) as TMDbTitle[]
      chosen = chooseBestSearchCandidate(item.title, item.year, oppositeCandidates)
      if (chosen) return { id: chosen.id, mediaType: oppositeMediaType }
    } catch (err) {
      console.warn(`[Import] Search failed for query "${query}":`, err)
    }
    return null
  }

  // Phase 1: Search with original title
  let match = await searchAndMatch(item.title.trim(), item.mediaType)

  // Phase 2: Search with cleaned title
  if (!match) {
    const cleanedTitle = cleanSearchTitle(item.title)
    if (cleanedTitle && cleanedTitle !== item.title.trim()) {
      match = await searchAndMatch(cleanedTitle, item.mediaType)
    }
  }

  // Phase 3: Search without common leading articles
  if (!match) {
    const noArticlesTitle = stripLeadingArticles(item.title)
    if (noArticlesTitle && noArticlesTitle !== item.title.trim()) {
      match = await searchAndMatch(noArticlesTitle, item.mediaType)
    }
  }

  if (!match) return null

  // If media type was swapped, notify parent
  if (match.mediaType !== item.mediaType) {
    onMediaTypeChange(item.id, match.mediaType)
  }

  if (match.mediaType === 'movie') {
    const details = transformMovieToTitleDetails(
      tmdb,
      await tmdb.getMovieDetails(match.id),
      await tmdb.getMovieCredits(match.id)
    )
    return {
      titleId: await db.getOrCreateTitle(details),
      mediaType: match.mediaType,
    }
  }

  const details = transformTVToTitleDetails(
    tmdb,
    await tmdb.getTVDetails(match.id),
    await tmdb.getTVCredits(match.id)
  )
  return {
    titleId: await db.getOrCreateTitle(details),
    mediaType: match.mediaType,
  }
}
