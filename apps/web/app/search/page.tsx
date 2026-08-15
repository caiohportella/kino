'use client'

import { getLocale, getRegion, type SearchResult, TMDbTitle } from '@kino/core'
import { searchQueryKeys } from '@kino/core/cache'
import { SEARCH_SCHEMA_VERSION_V2 } from '@kino/core/search'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  type KeyboardEvent,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EmptyState, Poster } from '@/components/kino'
import { AppPagination } from '@/components/layout/app-pagination'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileSearchCard } from '@/components/profile/profile-search-card'
import { SearchSkeleton } from '@/components/skeletons/page-skeletons'
import { Button } from '@/components/ui/button'
import { useMediaPoster } from '@/hooks/use-media-poster'
import { useTranslation } from '@/lib/i18n'
import { personPath } from '@/lib/routes'
import { createSearchGatewayClient } from '@/lib/search/client'
import { toWebSearchGroups } from '@/lib/search/presentation'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

const MIN_QUERY_LENGTH = 1
const SEARCH_LIMIT = 50

const searchGateway = createSearchGatewayClient()

export default function SearchPage() {
  const language = useSettingsStore((state) => state.language)
  const localeStatus = useSettingsStore((state) => state.localeStatus)
  const { t } = useTranslation()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialQuery = searchParams.get('q') ?? ''

  const initialPage = (() => {
    const value = Number(searchParams.get('page'))

    return Number.isInteger(value) && value > 0 ? value : 1
  })()

  const [queryText, setQueryText] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim())
  const [searchPage, setSearchPage] = useState(initialPage)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const [_, setCaretAtEnd] = useState(true)

  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = queryText.trim()

      setDebouncedQuery(nextQuery)
      setSearchPage(1)
      setActiveIndex(-1)
      resultRefs.current = []

      const params = new URLSearchParams()

      if (nextQuery) {
        params.set('q', nextQuery)
      }

      const query = params.toString()

      window.history.replaceState(
        window.history.state,
        '',
        query ? `${pathname}?${query}` : pathname
      )
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [pathname, queryText])

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)

      const nextQuery: string = params.get('q') ?? ''

      const pageParam = params.get('page')
      const pageValue = pageParam ? Number(pageParam) : 1

      const nextPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1

      setQueryText(nextQuery)
      setDebouncedQuery(nextQuery.trim())
      setSearchPage(nextPage)
      setActiveIndex(-1)
      resultRefs.current = []
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
  const searching = debouncedQuery.length >= MIN_QUERY_LENGTH

  const searchQuery = useQuery({
    queryKey: searching
      ? searchQueryKeys.results({
          filters: {
            limit: SEARCH_LIMIT,
            mediaType: 'all',
            mode: 'full',
            schemaVersion: SEARCH_SCHEMA_VERSION_V2,
          },
          locale: getLocale(language),
          page: searchPage,
          query: debouncedQuery,
          region: getRegion(language),
          scope: { kind: 'public' },
        })
      : searchQueryKeys.resultsRoot(),

    queryFn: ({ signal }) =>
      searchGateway
        .search(
          {
            schemaVersion: SEARCH_SCHEMA_VERSION_V2,
            mode: 'full',
            query: debouncedQuery,
            locale: getLocale(language),
            region: getRegion(language),
            page: searchPage,
            limit: SEARCH_LIMIT,
          },
          signal
        )
        .then((response) =>
          toWebSearchGroups(response, {
            departmentLabels: {
              acting: t('person.department.Acting'),
              art: t('person.department.Art'),
              camera: t('person.department.Camera'),
              costumeAndMakeUp: t('person.department.Costume & Make-Up'),
              creator: t('person.department.Creator'),
              crew: t('person.department.Crew'),
              directing: t('person.department.Directing'),
              editing: t('person.department.Editing'),
              fallback: t('person.department.Person'),
              lighting: t('person.department.Lighting'),
              production: t('person.department.Production'),
              sound: t('person.department.Sound'),
              visualEffects: t('person.department.Visual Effects'),
              writing: t('person.department.Writing'),
            },
          })
        ),

    enabled: localeStatus !== 'resolving' && searching,

    retry: 1,
    staleTime: 60_000,
  })

  const flatResults = useMemo(
    () =>
      searchQuery.data
        ? [
            ...searchQuery.data.groups.movies,
            ...searchQuery.data.groups.series,
            ...searchQuery.data.groups.people,
            ...searchQuery.data.groups.users,
          ]
        : [],
    [searchQuery.data]
  )

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!flatResults.length) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      const offset = event.key === 'ArrowDown' ? 1 : -1

      const next = (activeIndex + offset + flatResults.length) % flatResults.length

      setActiveIndex(next)

      resultRefs.current[next]?.scrollIntoView({
        block: 'nearest',
      })

      return
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      resultRefs.current[activeIndex]?.click()
    }
  }

  function updatePage(nextPage: number) {
    setSearchPage(nextPage)
    setActiveIndex(-1)
    resultRefs.current = []

    const params = new URLSearchParams()

    if (debouncedQuery) {
      params.set('q', debouncedQuery)
    }

    if (nextPage > 1) {
      params.set('page', String(nextPage))
    }

    const query = params.toString()

    window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  let resultIndex = 0

  function updateCaretState() {
    const input = inputRef.current

    if (!input) {
      setCaretAtEnd(true)
      return
    }

    setCaretAtEnd(
      input.selectionStart === queryText.length && input.selectionEnd === queryText.length
    )
  }

  return (
    <div>
      <div className="content-frame" data-search-controls>
        <PageHeader
          eyebrow={t('search.results')}
          title={debouncedQuery ? `“${debouncedQuery}”` : t('search.title')}
        />

        <div className="mb-8">
          <label className="grid gap-2 text-sm font-semibold text-kino-text" htmlFor="search">
            <span className="sr-only">{t('search.title')}</span>

            <div className="relative">
              <input
                aria-activedescendant={
                  activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
                }
                aria-controls="full-search-results"
                aria-expanded={searching}
                aria-haspopup="listbox"
                autoComplete="off"
                className="
                  min-h-11 w-full rounded-md
                  border border-white/10
                  bg-kino-surface
                  px-3 pr-11
                  text-base text-kino-text
                  outline-none
                  transition-colors
                  placeholder:text-kino-muted
                  focus:border-kino-accent
                "
                id="search"
                ref={inputRef}
                onChange={(event) => {
                  setQueryText(event.target.value)
                  setActiveIndex(-1)
                  setCaretAtEnd(true)
                }}
                onClick={updateCaretState}
                onKeyUp={updateCaretState}
                onSelect={updateCaretState}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('search.placeholder')}
                role="combobox"
                value={queryText}
              />

              {queryText ? (
                <Button
                  aria-label={t('search.clear')}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => {
                    setQueryText('')
                    setDebouncedQuery('')
                    setSearchPage(1)
                    setActiveIndex(-1)
                    resultRefs.current = []

                    window.history.replaceState(window.history.state, '', pathname)
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <X size={16} />
                </Button>
              ) : null}
            </div>
          </label>
        </div>
      </div>

      <section
        className="content-frame min-w-0"
        data-search-results
        id="full-search-results"
        role={searching ? 'listbox' : undefined}
      >
        {searching && searchQuery.isLoading ? <SearchSkeleton label={t('search.loading')} /> : null}

        {searching && searchQuery.error ? (
          <RetryState onRetry={() => searchQuery.refetch()} t={t} />
        ) : null}

        {!searching && queryText.trim().length > 0 ? (
          <div className="py-12 text-center text-sm text-kino-muted">
            {t('search.minimumCharacters', {
              count: MIN_QUERY_LENGTH,
            })}
          </div>
        ) : null}

        {searching && searchQuery.data ? (
          <div className="grid gap-14 lg:gap-16">
            <SearchGroup
              activeIndex={activeIndex}
              entityType="title"
              failed={searchQuery.data.failed.movies}
              label={t('search.movies')}
              onRetry={() => searchQuery.refetch()}
              refs={resultRefs}
              results={searchQuery.data.groups.movies}
              startIndex={resultIndex}
              t={t}
            />

            {(() => {
              resultIndex += searchQuery.data.groups.movies.length

              return null
            })()}

            <SearchGroup
              activeIndex={activeIndex}
              entityType="title"
              failed={searchQuery.data.failed.series}
              label={t('search.tvShows')}
              onRetry={() => searchQuery.refetch()}
              refs={resultRefs}
              results={searchQuery.data.groups.series}
              startIndex={resultIndex}
              t={t}
            />

            {(() => {
              resultIndex += searchQuery.data.groups.series.length

              return null
            })()}

            <SearchGroup
              activeIndex={activeIndex}
              entityType="person"
              failed={searchQuery.data.failed.people}
              label={t('search.people')}
              onRetry={() => searchQuery.refetch()}
              refs={resultRefs}
              results={searchQuery.data.groups.people}
              startIndex={resultIndex}
              t={t}
            />

            {(() => {
              resultIndex += searchQuery.data.groups.people.length

              return null
            })()}

            <SearchGroup
              activeIndex={activeIndex}
              entityType="user"
              failed={searchQuery.data.failed.users}
              label={t('search.users')}
              onRetry={() => searchQuery.refetch()}
              refs={resultRefs}
              results={searchQuery.data.groups.users}
              startIndex={resultIndex}
              t={t}
            />

            {!flatResults.length && !Object.values(searchQuery.data.failed).some(Boolean) ? (
              <EmptyState
                body={t('search.noResultsHint')}
                illustrationLabel={t('emptyStates.searchIllustration')}
                title={t('search.noResults')}
                variant="search"
              />
            ) : null}

            {searchPage > 1 || searchQuery.data.nextPage ? (
              <AppPagination
                label={t('search.pages')}
                onPageChange={updatePage}
                page={searchPage}
                totalPages={
                  searchQuery.data.nextPage
                    ? Math.max(searchPage + 1, searchQuery.data.nextPage)
                    : searchPage
                }
              />
            ) : null}
          </div>
        ) : null}

        {!queryText.trim() ? (
          <div className="py-12 text-center text-sm text-kino-muted">{t('search.placeholder')}</div>
        ) : null}
      </section>
    </div>
  )
}

function SearchTitleResult({
  active,
  id,
  item,
  linkRef,
  role,
}: {
  active?: boolean
  id?: string
  item: TMDbTitle
  linkRef?: (node: HTMLAnchorElement | null) => void
  role?: string
}) {
  const { href, poster, prefetch, title, year } = useMediaPoster(item)

  return (
    <Link
      aria-selected={active}
      className={cn('group min-w-0 focus-ring', active && 'rounded-md ring-2 ring-kino-accent/40')}
      href={href}
      id={id}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      ref={linkRef}
      role={role}
    >
      <Poster className="w-full rounded-md" details={{ year }} src={poster} title={title} />
    </Link>
  )
}

function SearchGroup({
  entityType,
  label,
  results,
  failed,
  startIndex,
  refs,
  activeIndex,
  onRetry,
  t,
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
  if (!failed && !results.length) {
    return null
  }

  const gridClassName =
    entityType === 'title'
      ? 'poster-grid'
      : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <section aria-labelledby={`search-group-${entityType}-${startIndex}`} className="scroll-mt-24">
      <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-3">
        <h2
          className="text-xl font-bold tracking-tight text-kino-text"
          id={`search-group-${entityType}-${startIndex}`}
        >
          {label}
        </h2>

        {failed ? (
          <Button onClick={onRetry} size="sm" variant="ghost">
            <AlertCircle size={15} />
            {t('search.retry')}
          </Button>
        ) : null}
      </div>

      {failed ? (
        <p className="text-sm text-kino-muted">{t('search.sectionFailed')}</p>
      ) : (
        <div className={gridClassName}>
          {results.map((result, offset) => {
            const index = startIndex + offset

            const common = {
              active: activeIndex === index,
              id: `search-result-${index}`,
              linkRef: (node: HTMLAnchorElement | null) => {
                refs.current[index] = node
              },
              role: 'option',
            }

            if (result.kind === 'title') {
              return (
                <SearchTitleResult
                  {...common}
                  item={result.media}
                  key={`title-${result.mediaType}-${result.id}`}
                />
              )
            }

            return (
              <ProfileSearchCard
                {...common}
                avatarUrl={result.avatarUrl ?? undefined}
                backgroundUrl={result.backgroundUrl ?? undefined}
                entityLabel={result.kind === 'user' ? t('search.user') : t('search.person')}
                href={
                  result.kind === 'person'
                    ? personPath(result.id, result.name)
                    : `/${result.username}`
                }
                imageFallbackLabel={t('search.noProfileImage')}
                key={`${result.kind}-${result.id}`}
                name={result.name}
                subtitle={
                  result.kind === 'person' ? result.summary || t('search.knownFor') : undefined
                }
                username={result.kind === 'user' ? result.username : undefined}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function RetryState({
  onRetry,
  t,
}: {
  onRetry: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  return (
    <div className="grid justify-items-start gap-3 rounded-md border border-white/10 p-5">
      <p className="text-sm text-kino-muted">{t('search.searchFailed')}</p>

      <Button onClick={onRetry} variant="secondary">
        {t('search.retry')}
      </Button>
    </div>
  )
}
