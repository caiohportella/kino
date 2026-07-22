'use client'

import type { MediaType, SearchResult, TMDbGenre, TMDbTitle } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'
import { EmptyState } from '@/components/kino'
import { MediaCard } from '@/components/media-card'
import { ProfileSearchCard } from '@/components/profile-search-card'
import { PageHeader } from '@/components/page-header'
import { SearchSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTranslation } from '@/lib/i18n'
import { getPersonImagePaths } from '@/lib/person-visuals'
import { personPath } from '@/lib/routes'
import { db, getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/stores/library-store'
import { useSettingsStore } from '@/stores/settings-store'

const MIN_QUERY_LENGTH = 2

export default function SearchPage() {
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const queryText = useLibraryStore((state) => state.query)
  const setQuery = useLibraryStore((state) => state.setQuery)
  const mediaType = useLibraryStore((state) => state.mediaType)
  const setMediaType = useLibraryStore((state) => state.setMediaType)
  const minRating = useLibraryStore((state) => state.minRating)
  const setMinRating = useLibraryStore((state) => state.setMinRating)
  const genreIds = useLibraryStore((state) => state.genreIds)
  const toggleGenre = useLibraryStore((state) => state.toggleGenre)
  const clearFilters = useLibraryStore((state) => state.clearFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(queryText)
  const [activeIndex, setActiveIndex] = useState(-1)
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(queryText.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [queryText])

  const searching = debouncedQuery.length >= MIN_QUERY_LENGTH
  const genresQuery = useQuery({
    queryKey: ['genres', language],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const [movie, tv] = await Promise.all([tmdb.getGenres('movie'), tmdb.getGenres('tv')])
      const merged = new Map<number, TMDbGenre>()
      for (const genre of [...movie, ...tv]) merged.set(genre.id, genre)
      return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
    },
  })

  const discoveryQuery = useQuery({
    queryKey: ['discover-search', language, mediaType, minRating, genreIds.join(',')],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const params: Record<string, string> = { sort_by: 'popularity.desc' }
      if (genreIds.length) params.with_genres = genreIds.join(',')
      if (minRating > 0) {
        params['vote_average.gte'] = String(minRating)
        params['vote_count.gte'] = '50'
      }
      const types: MediaType[] = mediaType === 'all' ? ['movie', 'tv'] : [mediaType]
      return (await Promise.all(types.map((type) => tmdb.discoverMedia(type, params))))
        .flat()
        .sort((a, b) => b.vote_average - a.vote_average)
    },
    enabled: !searching,
  })

  const searchQuery = useQuery({
    queryKey: ['global-search', language, debouncedQuery],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const [titlesState, peopleState, usersState] = await Promise.allSettled([
        tmdb.search(debouncedQuery),
        tmdb.searchPeople(debouncedQuery),
        db.searchUsers(debouncedQuery),
      ])
      const titles: SearchResult[] = titlesState.status === 'fulfilled'
        ? titlesState.value.results.slice(0, 12).map((item) => ({
            kind: 'title', id: item.id, mediaType: item.media_type!,
            name: item.title || item.name || t('diary.unknownTitle'), imagePath: item.poster_path,
            year: Number((item.release_date || item.first_air_date || '').slice(0, 4)) || undefined,
            media: item,
          }))
        : []
      const people: SearchResult[] = peopleState.status === 'fulfilled'
        ? peopleState.value.results.slice(0, 8).map((person) => {
            const { bannerPath, portraitPath } = getPersonImagePaths(person)

            return {
              kind: 'person', id: person.id, name: person.name,
              avatarUrl: tmdb.getImageUrl(portraitPath, 'w300'),
              backgroundUrl: tmdb.getBackdropUrl(bannerPath, 'w780'),
              summary: person.known_for_department || undefined,
            }
          })
        : []
      const users: SearchResult[] = usersState.status === 'fulfilled'
        ? usersState.value.slice(0, 8).filter((user) => user.username).map((user) => ({
            kind: 'user', id: user.id, name: user.display_name || user.username!,
            username: user.username!, avatarUrl: user.avatar_url,
            backgroundUrl: user.banner_url || user.avatar_url,
          }))
        : []
      return {
        groups: { titles, people, users },
        failed: {
          titles: titlesState.status === 'rejected', people: peopleState.status === 'rejected',
          users: usersState.status === 'rejected',
        },
      }
    },
    enabled: searching,
    retry: 1,
  })

  const flatResults = useMemo(() => searchQuery.data
    ? [...searchQuery.data.groups.titles, ...searchQuery.data.groups.people, ...searchQuery.data.groups.users]
    : [], [searchQuery.data])

  const filteredDiscovery = ((discoveryQuery.data || []).filter((item) => {
    if (mediaType !== 'all' && item.media_type !== mediaType) return false
    if (minRating > 0 && item.vote_average < minRating) return false
    return !genreIds.length || genreIds.every((id) => item.genre_ids?.includes(id))
  })) as TMDbTitle[]

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!flatResults.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const offset = event.key === 'ArrowDown' ? 1 : -1
      const next = (activeIndex + offset + flatResults.length) % flatResults.length
      setActiveIndex(next)
      resultRefs.current[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      resultRefs.current[activeIndex]?.click()
    } else if (event.key === 'Escape') {
      setQuery('')
      setActiveIndex(-1)
    }
  }

  let resultIndex = 0
  return (
    <div className="content-frame">
      <PageHeader action={<Button aria-controls="search-filters" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)} variant="secondary"><SlidersHorizontal size={16} />{t('search.filters')}</Button>} title={t('search.title')} />
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-semibold text-kino-text" htmlFor="search">
          {t('search.title')}
          <input aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined} aria-controls="global-search-results" aria-expanded={searching} aria-haspopup="listbox" autoComplete="off" className="min-h-11 w-full rounded-md border border-white/10 bg-kino-surface px-3 text-base text-kino-text outline-none transition-colors placeholder:text-kino-muted focus:border-kino-accent" id="search" onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); resultRefs.current = [] }} onKeyDown={handleSearchKeyDown} placeholder={t('search.placeholder')} role="combobox" value={queryText} />
        </label>
        <div className="flex items-end"><Button onClick={() => { setQuery(''); clearFilters() }} variant="ghost"><X size={16} />{t('search.clear')}</Button></div>
      </div>

      {showFilters && !searching ? <SearchFilters genres={genresQuery.data || []} genreIds={genreIds} mediaType={mediaType} minRating={minRating} setMediaType={setMediaType} setMinRating={setMinRating} t={t} toggleGenre={toggleGenre} /> : null}

      <section className="min-w-0" id="global-search-results" role={searching ? 'listbox' : undefined}>
        {(searching ? searchQuery.isLoading : discoveryQuery.isLoading) ? <SearchSkeleton label={t('search.loading')} /> : null}
        {searching && searchQuery.error ? <RetryState onRetry={() => searchQuery.refetch()} t={t} /> : null}
        {searching && searchQuery.data ? (
          <div className="grid gap-8">
            <SearchGroup entityType="title" label={t('search.titles')} results={searchQuery.data.groups.titles} failed={searchQuery.data.failed.titles} startIndex={resultIndex} refs={resultRefs} activeIndex={activeIndex} onRetry={() => searchQuery.refetch()} t={t} />
            {(() => { resultIndex += searchQuery.data.groups.titles.length; return null })()}
            <SearchGroup entityType="person" label={t('search.people')} results={searchQuery.data.groups.people} failed={searchQuery.data.failed.people} startIndex={resultIndex} refs={resultRefs} activeIndex={activeIndex} onRetry={() => searchQuery.refetch()} t={t} />
            {(() => { resultIndex += searchQuery.data.groups.people.length; return null })()}
            <SearchGroup entityType="user" label={t('search.users')} results={searchQuery.data.groups.users} failed={searchQuery.data.failed.users} startIndex={resultIndex} refs={resultRefs} activeIndex={activeIndex} onRetry={() => searchQuery.refetch()} t={t} />
            {!flatResults.length && !Object.values(searchQuery.data.failed).some(Boolean) ? <EmptyState body={t('search.noResultsHint')} illustrationLabel={t('emptyStates.searchIllustration')} title={t('search.noResults')} variant="search" /> : null}
          </div>
        ) : null}
        {!searching && !discoveryQuery.isLoading ? <div className="poster-grid">{filteredDiscovery.map((item) => <MediaCard item={item} key={`${item.media_type}-${item.id}`} />)}</div> : null}
      </section>
    </div>
  )
}

function SearchGroup({
  entityType, label, results, failed, startIndex, refs, activeIndex, onRetry, t,
}: {
  entityType: SearchResult['kind']
  label: string
  results: SearchResult[]
  failed: boolean
  startIndex: number
  refs: MutableRefObject<Array<HTMLAnchorElement | null>>
  activeIndex: number
  onRetry: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  if (!failed && !results.length) return null
  const gridClassName = entityType === 'title'
    ? 'poster-grid'
    : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <section aria-labelledby={`group-${entityType}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-kino-text" id={`group-${entityType}`}>{label}</h2>
        {failed ? <Button onClick={onRetry} size="sm" variant="ghost"><AlertCircle size={15} />{t('search.retry')}</Button> : null}
      </div>
      {failed ? <p className="text-sm text-kino-muted">{t('search.sectionFailed')}</p> : (
        <div className={gridClassName}>
          {results.map((result, offset) => {
            const index = startIndex + offset
            const common = {
              active: activeIndex === index,
              id: `search-result-${index}`,
              linkRef: (node: HTMLAnchorElement | null) => { refs.current[index] = node },
              role: 'option',
            }
            if (result.kind === 'title') {
              return <MediaCard {...common} item={result.media} key={`title-${result.id}`} />
            }
            return (
              <ProfileSearchCard
                {...common}
                avatarUrl={result.avatarUrl}
                backgroundUrl={result.backgroundUrl}
                entityLabel={result.kind === 'user' ? t('search.user') : t('search.person')}
                href={result.kind === 'person' ? personPath(result.id, result.name) : `/${result.username}`}
                imageFallbackLabel={t('search.noProfileImage')}
                key={`${result.kind}-${result.id}`}
                name={result.name}
                subtitle={result.kind === 'person' ? result.summary || t('search.knownFor') : undefined}
                username={result.kind === 'user' ? result.username : undefined}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function RetryState({ onRetry, t }: { onRetry: () => void; t: ReturnType<typeof useTranslation>['t'] }) { return <div className="grid justify-items-start gap-3 rounded-md border border-white/10 p-5"><p className="text-sm text-kino-muted">{t('search.searchFailed')}</p><Button onClick={onRetry} variant="secondary">{t('search.retry')}</Button></div> }

function SearchFilters({ genres, genreIds, mediaType, minRating, setMediaType, setMinRating, t, toggleGenre }: { genres: TMDbGenre[]; genreIds: number[]; mediaType: 'all' | MediaType; minRating: number; setMediaType: (value: 'all' | MediaType) => void; setMinRating: (value: number) => void; t: ReturnType<typeof useTranslation>['t']; toggleGenre: (id: number) => void }) { return <aside className="mb-6 grid gap-5 rounded-md border border-white/10 bg-kino-panel p-5" id="search-filters"><div><div className="mb-2 text-sm font-semibold text-kino-text">{t('search.mediaType')}</div><SegmentedControl onChange={setMediaType} options={[{ label: t('search.all'), value: 'all' }, { label: t('search.movies'), value: 'movie' }, { label: t('search.tvShows'), value: 'tv' }]} value={mediaType} /></div><label className="grid gap-2 text-sm text-kino-muted"><span className="font-semibold text-kino-text">{t('search.minimumRating')}: {minRating || t('search.any')}</span><input max={9} min={0} onChange={(event) => setMinRating(Number(event.target.value))} step={1} type="range" value={minRating} /></label><div><div className="mb-3 text-sm font-semibold text-kino-text">{t('search.genres')}</div><div className="flex flex-wrap gap-2">{genres.map((genre) => { const active = genreIds.includes(genre.id); return <button className={cn('rounded-md border px-2.5 py-1.5 text-xs font-semibold', active ? 'border-kino-accent bg-kino-accent text-black' : 'border-white/10 bg-white/[0.04] text-kino-muted hover:text-kino-text')} key={genre.id} onClick={() => toggleGenre(genre.id)} type="button">{genre.name}</button> })}</div></div></aside> }
