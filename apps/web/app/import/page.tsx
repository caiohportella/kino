'use client'

import type { ImportTitleItem, MediaType, TMDbTitle } from '@kino/core'
import {
  activityQueryKeys,
  chooseBestSearchCandidate,
  parseImportFile,
  transformMovieToTitleDetails,
  transformTVToTitleDetails,
} from '@kino/core'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CloudUpload, RotateCcw, Save, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ProtectedContentGate } from '@/components/auth/protected-content-gate'
import { ProtectedEmpty } from '@/components/auth/protected-empty'
import { EmptyState, ProgressBar } from '@/components/kino'
import { AppPagination } from '@/components/layout/app-pagination'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/localization/i18n'
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
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const resolution = useAuthStore((state) => state.resolution)
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
      setError(
        caught instanceof Error
          ? translateImportMessage(caught.message, t)
          : t('importFlow.parseFailed')
      )
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
      setError(t('importFlow.chooseItems'))
      return
    }

    setImporting(true)
    setError(null)
    setImportSummary(null)
    setProgress({
      completed: 0,
      total: included.length,
      imported: 0,
      skipped: 0,
      failed: 0,
    })

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
              importError: t('importFlow.alreadyInDiary'),
            })
            skippedCount += 1
          } else if (
            resolvedTitle.mediaType === 'movie' ||
            !item.tvEpisodes ||
            item.tvEpisodes.length === 0
          ) {
            if (item.rating === null)
              throw new Error(t('importFlow.ratingRequired', { title: item.title }))
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
            updateItem(item.id, {
              importStatus: 'success',
              importError: undefined,
            })
            importedCount += 1
          } else {
            const episodes = item.tvEpisodes || []
            for (const episode of episodes) {
              const rating = episode.rating ?? item.rating
              if (rating === null)
                throw new Error(t('importFlow.ratingsRequired', { title: item.title }))
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
            updateItem(item.id, {
              importStatus: 'success',
              importError: undefined,
            })
            importedCount += 1
          }
        } catch (caught) {
          console.error(`[Import] Web item import failed for: ${item.title}`, caught)
          const errorMsg =
            caught instanceof Error
              ? translateImportMessage(caught.message, t)
              : t('importFlow.importFailed')
          updateItem(item.id, {
            importStatus: 'failed',
            importError: errorMsg,
          })
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

      setImportSummary({
        imported: importedCount,
        skipped: skippedCount,
        failed: failureCount,
      })
      if (importedCount > 0) {
        queryClient.invalidateQueries({ queryKey: activityQueryKeys.all })
      }
      setError(failureCount > 0 ? t('importFlow.itemsFailed', { count: failureCount }) : null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? translateImportMessage(caught.message, t)
          : t('importFlow.importFailed')
      )
    } finally {
      setImporting(false)
    }
  }

  const includedCount = state.items.filter((item) => item.include).length
  const ITEMS_PER_PAGE = 20
  const totalPages = Math.max(1, Math.ceil(state.items.length / ITEMS_PER_PAGE))
  const paginatedItems = state.items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <ProtectedContentGate
      authLoadingFallback={<ProfileSkeleton label={t('importFlow.loading')} />}
      emptyFallback={<ProfileSkeleton label={t('importFlow.loading')} />}
      errorFallback={<EmptyState body={t('common.tryAgain')} title={t('importFlow.unavailable')} />}
      pageStatus="content"
      resolution={resolution}
      unauthenticatedFallback={<ProtectedEmpty />}
    >
      <div className="content-frame">
        <PageHeader
          title={t('importFlow.headerPhrase', {
            defaultValue: 'Bring your history with you.',
          })}
        />

        <Card className="mb-6 grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-kino-text">{t('importFlow.letterboxd')}</h2>
            <p className="mt-2 text-sm leading-6 text-kino-muted">
              {t('importFlow.letterboxdDescription')}
            </p>
            {state.fileName ? (
              <p className="mt-2 text-sm font-semibold text-kino-accent">{state.fileName}</p>
            ) : null}
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-kino-accent px-4 py-3 text-sm font-semibold text-black">
            <CloudUpload size={16} />
            {loading ? t('importFlow.parsing') : t('importFlow.chooseFile')}
            <input
              accept=".csv,text/csv"
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
            {translateImportMessage(item, t)}
          </p>
        ))}
        {state.warnings.map((item) => (
          <p
            className="mb-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100"
            key={item}
          >
            {translateImportMessage(item, t)}
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
              {t('importFlow.progress', { completed: progress.completed, total: progress.total })}
            </div>
            <ProgressBar value={progress.total ? (progress.completed / progress.total) * 100 : 0} />
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-kino-muted">
              <span>{t('importFlow.importedCount', { count: progress.imported })}</span>
              <span>{t('importFlow.skippedCount', { count: progress.skipped })}</span>
              <span>{t('importFlow.failedCount', { count: progress.failed })}</span>
            </div>
          </Card>
        ) : null}

        {importSummary ? (
          <Card className="mb-6 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-kino-text">{t('importFlow.finished')}</h2>
                <p className="mt-2 text-sm leading-6 text-kino-muted">
                  {t('importFlow.summary', {
                    imported: importSummary.imported,
                    skipped: importSummary.skipped,
                    failed: importSummary.failed,
                  })}
                </p>
              </div>
              <Button onClick={() => router.push('/diary')} variant="secondary">
                {t('importFlow.viewDiary')}
              </Button>
            </div>
          </Card>
        ) : null}

        {state.items.length === 0 ? (
          <EmptyState body={t('importFlow.noFileBody')} title={t('importFlow.noFile')} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-kino-muted">
                {t('importFlow.selectedCount', {
                  selected: includedCount,
                  total: state.items.length,
                })}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setState(emptyState)
                    setPage(1)
                    setError(null)
                    setImportSummary(null)
                    setProgress({
                      completed: 0,
                      total: 0,
                      imported: 0,
                      skipped: 0,
                      failed: 0,
                    })
                  }}
                  variant="secondary"
                >
                  <RotateCcw size={16} />
                  {t('importFlow.reset')}
                </Button>
                <Button disabled={importing || includedCount === 0} onClick={handleImport}>
                  <Save size={16} />
                  {t('importFlow.importSelected')}
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {paginatedItems.map((item) => (
                <ImportRow item={item} key={item.id} onChange={updateItem} />
              ))}
            </div>

            <AppPagination
              label={t('importFlow.resultsPages')}
              onPageChange={setPage}
              page={page}
              totalPages={totalPages}
            />
          </>
        )}
      </div>
    </ProtectedContentGate>
  )
}

function ImportRow({
  item,
  onChange,
}: {
  item: ImportTitleItem
  onChange: (id: string, updates: Partial<ImportTitleItem>) => void
}) {
  const { t } = useTranslation()
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
            <span className="rounded-md bg-white/6 px-2 py-1 text-xs font-semibold text-kino-muted">
              {item.mediaType === 'movie' ? t('importFlow.movie') : t('importFlow.series')}
            </span>
            <span className="rounded-md bg-white/6 px-2 py-1 text-xs font-semibold text-kino-muted">
              {t('importFlow.letterboxd')}
            </span>
            {item.importStatus === 'success' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
                <CheckCircle2 size={14} /> {t('importFlow.statusImported')}
              </span>
            )}
            {item.importStatus === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                <XCircle size={14} /> {t('importFlow.statusFailed')}
              </span>
            )}
            {item.importStatus === 'skipped' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-300">
                <AlertTriangle size={14} /> {t('importFlow.statusSkipped')}
              </span>
            )}
            {item.importStatus === 'processing' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-kino-accent">
                <Skeleton className="size-3.5 rounded-full" /> {t('importFlow.processing')}
              </span>
            )}
          </div>
          {item.importStatus === 'failed' ? (
            <p className="mt-2 text-sm text-red-300 font-medium">
              {item.importError || t('importFlow.notFound', { title: item.title })}
            </p>
          ) : item.importStatus === 'skipped' ? (
            <p className="mt-2 text-sm font-medium text-orange-200">
              {item.importError || t('importFlow.alreadyInDiary')}
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
            <Skeleton className="size-4 rounded-full" />
          ) : (
            <input
              checked={item.include}
              onChange={(event) => onChange(item.id, { include: event.target.checked })}
              type="checkbox"
            />
          )}
          {item.importStatus === 'success'
            ? t('importFlow.saved')
            : item.importStatus === 'skipped'
              ? t('importFlow.skipped')
              : t('importFlow.include')}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_160px_160px]">
        <Field
          label={t('importFlow.titleField')}
          onChange={(event) => onChange(item.id, { title: event.target.value })}
          value={item.title}
          disabled={isLocked}
        />
        <Field
          label={t('importFlow.watchedDate')}
          onChange={(event) =>
            onChange(item.id, {
              watchedAt: new Date(event.target.value).toISOString(),
            })
          }
          type="date"
          value={item.watchedAt.slice(0, 10)}
          disabled={isLocked}
        />
        <Field
          label={t('importFlow.rating')}
          max={5}
          min={0}
          onChange={(event) =>
            onChange(item.id, {
              rating: event.target.value ? Number(event.target.value) : null,
            })
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
          { label: t('importFlow.firstTime'), value: 'first-time' },
          { label: t('importFlow.rewatch'), value: 'rewatch' },
        ]}
        value={item.watchType}
      />

      <TextArea
        label={t('importFlow.notes')}
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

function translateImportMessage(
  message: string,
  t: (key: string, options?: Record<string, string | number>) => string
) {
  if (message === 'Unsupported file format. Upload a Letterboxd .csv export.') {
    return t('importFlow.unsupported')
  }
  if (message === 'The Letterboxd export is empty.') return t('importFlow.emptyExport')
  if (message === 'No Letterboxd rows could be parsed.') return t('importFlow.noRows')
  if (message === 'Skipped a Letterboxd row without a title.') return t('importFlow.skippedRow')
  if (message === 'Import failed' || message === 'Import failed.')
    return t('importFlow.importFailed')

  const missingTitle = message.match(/^Could not find "(.+)" in TMDB\.$/)
  if (missingTitle?.[1]) return t('importFlow.notFound', { title: missingTitle[1] })

  const missingRating = message.match(/^"(.+)" needs a rating\.$/)
  if (missingRating?.[1]) return t('importFlow.ratingRequired', { title: missingRating[1] })

  const missingRatings = message.match(/^"(.+)" needs ratings before import\.$/)
  if (missingRatings?.[1]) return t('importFlow.ratingsRequired', { title: missingRatings[1] })

  return message
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
