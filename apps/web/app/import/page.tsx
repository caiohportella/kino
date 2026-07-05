'use client'

import type { ImportTitleItem, MediaType, TMDbTitle } from '@kino/core'
import {
  Button,
  Card,
  EmptyState,
  Field,
  ProgressBar,
  SegmentedControl,
  TextArea,
} from '@kino/ui'
import {
  chooseBestSearchCandidate,
  parseImportFile,
  transformMovieToTitleDetails,
  transformTVToTitleDetails,
} from '@kino/core'
import { CloudUpload, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return <ProtectedEmpty body="Imports write into your Kino account after local review." title="Sign in to import history" />
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await parseImportFile(file)
      setState({
        fileName: parsed.fileName,
        items: parsed.items,
        warnings: parsed.warnings,
        errors: parsed.errors,
      })
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
    setProgress({ completed: 0, total: included.length })
    try {
      for (let index = 0; index < included.length; index += 1) {
        const item = included[index]
        if (!item) continue
        const titleId = await resolveTitleId(item)
        if (!titleId) throw new Error(`Could not match "${item.title}" in TMDB.`)

        if (item.mediaType === 'movie') {
          if (item.rating === null) throw new Error(`"${item.title}" needs a rating.`)
          const watchedAt = new Date(item.watchedAt)
          await db.rateTitle(titleId, item.rating, item.watchType, watchedAt, item.notes)
          await db.addWatchDiaryEntry(titleId, watchedAt, item.watchType, item.notes)
        } else {
          const episodes = item.tvEpisodes || []
          for (const episode of episodes) {
            const rating = episode.rating ?? item.rating
            if (rating === null) throw new Error(`"${item.title}" needs ratings before import.`)
            await db.rateEpisode(
              titleId,
              episode.seasonNumber,
              episode.episodeNumber,
              rating,
              episode.watchType,
              new Date(episode.watchedAt),
              item.notes
            )
          }
          await db.addWatchDiaryEntry(titleId, new Date(item.watchedAt), item.watchType, item.notes)
        }

        setProgress({ completed: index + 1, total: included.length })
      }

      router.push('/diary')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const includedCount = state.items.filter((item) => item.include).length

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
          {state.fileName ? <p className="mt-2 text-sm font-semibold text-kino-accent">{state.fileName}</p> : null}
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
        <p className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" key={item}>
          {item}
        </p>
      ))}
      {state.warnings.map((item) => (
        <p className="mb-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100" key={item}>
          {item}
        </p>
      ))}
      {error ? <p className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      {importing ? (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-kino-text">
            Importing {progress.completed} of {progress.total}
          </div>
          <ProgressBar value={progress.total ? (progress.completed / progress.total) * 100 : 0} />
        </Card>
      ) : null}

      {state.items.length === 0 ? (
        <EmptyState body="Choose an export file above to preview the mapped titles." title="No file selected" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-kino-muted">
              {includedCount} of {state.items.length} items selected
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setState(emptyState)} tone="secondary">
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
            {state.items.map((item) => (
              <ImportRow item={item} key={item.id} onChange={updateItem} />
            ))}
          </div>
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
  return (
    <Card className={`grid gap-4 p-4 ${item.include ? '' : 'opacity-60'}`}>
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
          </div>
          {item.issue ? <p className="mt-2 text-sm text-orange-200">{item.issue}</p> : null}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-kino-muted">
          <input
            checked={item.include}
            onChange={(event) => onChange(item.id, { include: event.target.checked })}
            type="checkbox"
          />
          Include
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_160px_160px]">
        <Field label="Title" onChange={(event) => onChange(item.id, { title: event.target.value })} value={item.title} />
        <Field
          label="Watched date"
          onChange={(event) => onChange(item.id, { watchedAt: new Date(event.target.value).toISOString() })}
          type="date"
          value={item.watchedAt.slice(0, 10)}
        />
        <Field
          label="Rating"
          max={5}
          min={0}
          onChange={(event) => onChange(item.id, { rating: event.target.value ? Number(event.target.value) : null })}
          step={0.5}
          type="number"
          value={item.rating ?? ''}
        />
      </div>

      <SegmentedControl
        onChange={(watchType) => onChange(item.id, { watchType })}
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
      />
    </Card>
  )
}

async function resolveTitleId(item: ImportTitleItem) {
  const tmdb = getTmdb()
  const search = await tmdb.search(item.title.trim())
  const candidates = search.results.filter((result) => result.media_type === item.mediaType) as TMDbTitle[]
  const chosen = chooseBestSearchCandidate(item.title, item.year, candidates)
  if (!chosen) return null

  if (item.mediaType === 'movie') {
    const details = transformMovieToTitleDetails(
      tmdb,
      await tmdb.getMovieDetails(chosen.id),
      await tmdb.getMovieCredits(chosen.id)
    )
    return db.getOrCreateTitle(details)
  }

  const details = transformTVToTitleDetails(
    tmdb,
    await tmdb.getTVDetails(chosen.id),
    await tmdb.getTVCredits(chosen.id)
  )
  return db.getOrCreateTitle(details)
}
