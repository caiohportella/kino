'use client'

import type { TMDbImage, TMDbTitle } from '@kino/core'
import { getDisplayTitle, getReleaseYear } from '@kino/core'
import { ArrowLeft, ChevronRight, ImageOff, Loader2, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { LoadingPanel } from '@/components/loading-panel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

export function BannerPickerDialog({
  open,
  onOpenChange,
  currentBannerUrl,
  onSelectBanner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBannerUrl?: string | null
  onSelectBanner: (bannerUrl: string | null) => Promise<void> | void
}) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDbTitle[]>([])
  const [selectedMedia, setSelectedMedia] = useState<TMDbTitle | null>(null)
  const [mediaImages, setMediaImages] = useState<TMDbImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const language = useSettingsStore((state) => state.language)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSearchResults([])
    setSelectedMedia(null)
    setMediaImages([])
    setError(null)
  }, [open])

  const searchMutation = useMutation({
    mutationFn: async () => {
      const trimmedQuery = query.trim()
      if (!trimmedQuery) return []
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const response = await tmdb.search(trimmedQuery)
      return response.results.filter((item) => item.backdrop_path)
    },
    onMutate: () => {
      setError(null)
      setSelectedMedia(null)
      setMediaImages([])
    },
    onSuccess: (results) => setSearchResults(results),
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not search TMDB.')
    },
  })

  const imagesMutation = useMutation({
    mutationFn: async (media: TMDbTitle) => {
      const mediaType = media.media_type === 'tv' ? 'tv' : 'movie'
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const response = await tmdb.getMediaImages(mediaType, media.id)
      return [...response.backdrops].sort((left, right) => right.vote_average - left.vote_average)
    },
    onMutate: (media) => {
      setError(null)
      setSelectedMedia(media)
      setMediaImages([])
    },
    onSuccess: (images) => setMediaImages(images),
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not load TMDB images.')
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (bannerUrl: string | null) => {
      await onSelectBanner(bannerUrl)
    },
    onSuccess: () => onOpenChange(false),
  })

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select profile banner</DialogTitle>
          <DialogDescription>Search TMDB and choose a backdrop image for your profile header.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {selectedMedia ? (
            <div className="flex items-center justify-between gap-3">
              <Button onClick={() => setSelectedMedia(null)} size="sm" variant="secondary">
                <ArrowLeft size={16} />
                Results
              </Button>
              <div className="min-w-0 text-right">
                <div className="truncate text-sm font-semibold text-kino-text">{getDisplayTitle(selectedMedia)}</div>
                <div className="text-xs text-kino-muted">{mediaImages.length} backdrop options</div>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                searchMutation.mutate()
              }}
            >
              <label className="sr-only" htmlFor="banner-search">
                Search movies or series
              </label>
              <input
                autoFocus
                className="min-h-10 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-kino-text outline-none focus:border-kino-accent"
                id="banner-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies or series..."
                value={query}
              />
              <Button disabled={!query.trim() || searchMutation.isPending} type="submit">
                {searchMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Search
              </Button>
            </form>
          )}

          {!selectedMedia ? (
            <div className="max-h-[52vh] overflow-y-auto pr-1">
              {searchMutation.isPending ? <LoadingPanel label="Searching TMDB..." /> : null}
              {!searchMutation.isPending && searchResults.length === 0 ? (
                <div className="grid place-items-center rounded-md border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
                  <Search className="text-kino-subtle" size={36} />
                  <p className="mt-3 max-w-sm text-sm leading-6 text-kino-muted">
                    Search for a title to use one of its TMDB backdrops as your profile banner.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3">
                {searchResults.map((item) => {
                  const title = getDisplayTitle(item)
                  const poster = getTmdb().getImageUrl(item.poster_path, 'w200')
                  const year = getReleaseYear(item)
                  return (
                    <button
                      className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-2 text-left transition-colors hover:border-kino-accent/60 hover:bg-white/[0.07]"
                      disabled={imagesMutation.isPending || saveMutation.isPending}
                      key={`${item.media_type}-${item.id}`}
                      onClick={() => imagesMutation.mutate(item)}
                      type="button"
                    >
                      <div className="aspect-[2/3] overflow-hidden rounded bg-black/30">
                        {poster ? <img alt="" className="h-full w-full object-cover" src={poster} /> : null}
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 font-semibold text-kino-text">{title}</div>
                        <div className="mt-1 text-xs text-kino-muted">
                          {year || 'TBA'} - {item.media_type === 'tv' ? 'Series' : 'Movie'}
                        </div>
                      </div>
                      <ChevronRight className="text-kino-muted" size={18} />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="max-h-[56vh] overflow-y-auto pr-1">
              {imagesMutation.isPending ? <LoadingPanel label="Loading backdrops..." /> : null}
              {!imagesMutation.isPending && mediaImages.length === 0 ? (
                <div className="grid place-items-center rounded-md border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
                  <ImageOff className="text-kino-subtle" size={36} />
                  <p className="mt-3 max-w-sm text-sm leading-6 text-kino-muted">
                    No high-quality backdrops were found for this title.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {mediaImages.map((image) => {
                  const previewUrl = getTmdb().getBackdropUrl(image.file_path, 'w780')
                  const savedUrl = getTmdb().getBackdropUrl(image.file_path, 'w1280')
                  if (!previewUrl || !savedUrl) return null

                  return (
                    <button
                      className="group overflow-hidden rounded-md border border-white/10 bg-white/[0.04] text-left transition hover:border-kino-accent/70 disabled:opacity-60"
                      disabled={saveMutation.isPending}
                      key={image.file_path}
                      onClick={() => saveMutation.mutate(savedUrl)}
                      type="button"
                    >
                      <img alt="" className="aspect-video w-full object-cover transition group-hover:scale-[1.02]" src={previewUrl} />
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-kino-muted">
                        <span>{image.width} x {image.height}</span>
                        <span>{image.vote_average ? image.vote_average.toFixed(1) : 'TMDB'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error || saveMutation.error ? (
            <p className="text-sm text-red-300">
              {error || (saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not update banner.')}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              disabled={saveMutation.isPending || !currentBannerUrl}
              onClick={() => saveMutation.mutate(null)}
              variant="destructive"
            >
              <Trash2 size={16} />
              Remove banner
            </Button>
            <Button disabled={saveMutation.isPending} onClick={() => onOpenChange(false)} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
