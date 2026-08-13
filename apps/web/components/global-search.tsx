'use client'

import { localeRegion, SearchResult } from '@kino/core'
import { SEARCH_SCHEMA_VERSION_V2 } from '@kino/core/search'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { personPath, titlePath } from '@/lib/routes'
import { createSearchGatewayClient } from '@/lib/search/client'
import {
  getFeaturedTitleCompletion,
  selectFeaturedTitleResult,
  withoutFeaturedTitleResult,
} from '@/lib/search/featured-title'
import { toWebSearchGroups } from '@/lib/search/presentation'
import { getTmdb } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { FeaturedSearchResult } from './search/featured-search-result'

const searchGateway = createSearchGatewayClient()

type GlobalSearchData = ReturnType<typeof toWebSearchGroups>

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  const _pathname = usePathname()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K')

  const language = useSettingsStore((state) => state.language)
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1)
    }
  }, [open])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'

      if (!isSearchShortcut) return

      event.preventDefault()
      onOpenChange(!open)

      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }

    document.addEventListener('keydown', handleShortcut)

    return () => {
      document.removeEventListener('keydown', handleShortcut)
    }
  }, [onOpenChange, open])

  useEffect(() => {
    const navigatorWithUAData = navigator as Navigator & {
      userAgentData?: {
        platform?: string
      }
    }

    const platform = navigatorWithUAData.userAgentData?.platform ?? navigator.userAgent

    const isMac = /mac/i.test(platform)

    setShortcutLabel(isMac ? '⌘ K' : 'Ctrl K')
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(-1)
  }, [])

  useEffect(() => {
    if (activeIndex < 0) return

    resultRefs.current[activeIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex])

  const searching = debouncedQuery.length >= 2

  const searchQuery = useQuery<GlobalSearchData>({
    queryKey: ['global-search', debouncedQuery, language, 'autocomplete'],

    queryFn: ({ signal }) =>
      searchGateway
        .search(
          {
            schemaVersion: SEARCH_SCHEMA_VERSION_V2,
            mode: 'autocomplete',
            query: debouncedQuery,
            locale: language,
            region: localeRegion(language) ?? undefined,
            page: 1,
            limit: 8,
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

    enabled: open && searching,
    staleTime: 60_000,

    placeholderData: (previousData) => previousData,
  })

  const searchData = searchQuery.data

  const titleResults = searchData
    ? [...searchData.groups.movies, ...searchData.groups.series].filter(
        (result): result is Extract<SearchResult, { kind: 'title' }> => result.kind === 'title'
      )
    : []
  const featuredTitleResult = titleResults.length
    ? selectFeaturedTitleResult(debouncedQuery, titleResults)
    : null
  const predictedTitleCompletion =
    open && searchData ? getFeaturedTitleCompletion(query, featuredTitleResult) : null
  const compactTitleResults =
    featuredTitleResult === null
      ? titleResults
      : withoutFeaturedTitleResult(titleResults, featuredTitleResult)

  const peopleResults = searchData
    ? searchData.groups.people.filter(
        (result): result is Extract<SearchResult, { kind: 'person' }> => result.kind === 'person'
      )
    : []

  const userResults = searchData
    ? searchData.groups.users.filter(
        (result): result is Extract<SearchResult, { kind: 'user' }> => result.kind === 'user'
      )
    : []

  const navigableResults = [
    ...(featuredTitleResult ? [featuredTitleResult] : []),
    ...compactTitleResults,
    ...peopleResults,
    ...userResults,
  ]

  const hasResults = titleResults.length > 0 || peopleResults.length > 0 || userResults.length > 0

  const expanded = open && searching && !!searchData
  const resultIds = navigableResults.map((_, index) => `global-search-result-${index}`)

  const showEmpty = expanded && !searchQuery.isPending && !searchQuery.isError && !hasResults

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-w-0 flex-1 justify-end',
        open
          ? 'mx-2 flex max-w-[calc(100vw-1rem)] sm:mx-3 sm:max-w-[calc(100vw-1.5rem)] lg:mx-0 lg:max-w-none'
          : 'ml-2 hidden lg:flex'
      )}
    >
      {/* Bar + results */}
      <div
        className={cn(
          'relative z-50 flex flex-col overflow-visible rounded-lg border lg:rounded-md',
          'transition-[width,border-color,background-color] duration-300 ease-out',
          open
            ? 'w-full min-w-0 max-w-full border-white/10 bg-kino-surface/95 shadow-2xl backdrop-blur-xl'
            : 'w-9 border-transparent bg-transparent'
        )}
      >
        {/* Search bar row */}
        {/* Search bar row */}
        <div className="flex min-h-12 min-w-0 shrink-0 items-center lg:min-h-0">
          <Button
            aria-label={t('tabs.search')}
            className="shrink-0"
            onClick={() => onOpenChange(!open)}
            size="icon"
            variant="ghost"
          >
            <Search size={18} />
          </Button>

          <div className="relative min-w-0 flex-1">
            {predictedTitleCompletion ? (
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden whitespace-pre',
                  'pl-2 pr-3 text-base lg:text-sm'
                )}
              >
                <span className="whitespace-pre text-kino-text">{query}</span>

                <span className="whitespace-pre text-kino-muted/70">
                  {predictedTitleCompletion}
                </span>
              </div>
            ) : null}

            <input
              ref={inputRef}
              aria-hidden={!open}
              aria-activedescendant={activeIndex >= 0 ? resultIds[activeIndex] : undefined}
              aria-autocomplete={predictedTitleCompletion ? 'both' : 'list'}
              aria-controls="global-search-results"
              aria-expanded={expanded}
              className={cn(
                'relative z-10 w-full min-w-0 bg-transparent pl-2 pr-3',
                'text-base text-kino-text outline-none',
                'caret-kino-text',
                'transition-opacity duration-200 placeholder:text-kino-muted',
                'lg:text-sm',
                predictedTitleCompletion ? 'text-transparent' : '',
                open ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
              role="combobox"
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(-1)
              }}
              onKeyDown={(event) => {
                if (predictedTitleCompletion && event.key === 'Tab' && !event.shiftKey) {
                  event.preventDefault()

                  const nextQuery = `${query}${predictedTitleCompletion}`

                  setQuery(nextQuery)
                  setDebouncedQuery(nextQuery)
                  setActiveIndex(-1)
                  return
                }

                if (
                  predictedTitleCompletion &&
                  event.key === 'ArrowRight' &&
                  inputRef.current &&
                  inputRef.current.selectionStart === query.length &&
                  inputRef.current.selectionEnd === query.length
                ) {
                  event.preventDefault()

                  const nextQuery = `${query}${predictedTitleCompletion}`

                  setQuery(nextQuery)
                  setDebouncedQuery(nextQuery)
                  setActiveIndex(-1)
                  return
                }

                if (!navigableResults.length) return

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) =>
                    current >= navigableResults.length - 1 ? 0 : current + 1
                  )
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) =>
                    current <= 0 ? navigableResults.length - 1 : current - 1
                  )
                }

                if (event.key === 'Enter' && activeIndex >= 0) {
                  event.preventDefault()

                  const result = navigableResults[activeIndex]

                  if (!result) return

                  if (result.kind === 'title') {
                    window.location.href = titlePath(
                      result.media.id,
                      result.name,
                      result.mediaType === 'tv' ? 'tv' : 'movie'
                    )
                  } else if (result.kind === 'person') {
                    window.location.href = personPath(result.id, result.name)
                  } else if (result.kind === 'user') {
                    window.location.href = `/${result.username}`
                  }
                }
              }}
              placeholder={t('search.placeholder')}
              tabIndex={open ? 0 : -1}
              value={query}
            />
          </div>

          {open && query.length === 0 ? (
            <kbd
              className="
                mr-2 hidden shrink-0
                rounded border border-white/10 bg-white/6
                px-1.5 py-0.5
                text-[10px] font-medium text-kino-muted
                sm:block
              "
            >
              {shortcutLabel}
            </kbd>
          ) : null}

          {open ? (
            <Button
              aria-label={t('common.close')}
              className="shrink-0 lg:hidden"
              onClick={() => onOpenChange(false)}
              size="icon"
              variant="ghost"
            >
              <X size={18} />
            </Button>
          ) : null}
        </div>

        {/* Results */}
        <div
          className={cn(
            'absolute inset-x-0 top-[calc(100%+0.5rem)] w-full min-w-0 max-w-full lg:top-[calc(100%+0.25rem)]',
            'grid origin-top transition-[grid-template-rows,opacity,transform] duration-400 ease-out',
            expanded
              ? 'grid-rows-[1fr] translate-y-0 opacity-100'
              : 'pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0'
          )}
        >
          <div className="min-h-0 min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-kino-surface/95 shadow-2xl backdrop-blur-xl">
            <div
              id="global-search-results"
              className="max-h-[calc(100dvh-7rem)] min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-2 sm:p-4 lg:max-h-[65vh]"
            >
              {searchQuery.isPending ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      className="flex min-h-24 animate-pulse items-center gap-4 rounded-lg px-3 py-3"
                      key={index}
                    >
                      <div className="h-20 w-14 shrink-0 rounded-md bg-white/8" />

                      <div className="flex-1">
                        <div className="h-4 w-2/3 rounded bg-white/8" />
                        <div className="mt-2 h-3 w-16 rounded bg-white/6" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {showEmpty ? (
                <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
                  <p className="text-sm text-kino-muted">{t('search.noResults')}</p>
                </div>
              ) : null}

              {searchQuery.isError ? (
                <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
                  <p className="text-sm text-kino-muted">{t('search.failed')}</p>
                </div>
              ) : null}

              {titleResults.length > 0 ? (
                <div className="grid gap-3">
                  {featuredTitleResult ? (
                    <FeaturedSearchResult
                      active={activeIndex === 0}
                      id={resultIds[0] ?? 'global-search-result-0'}
                      linkRef={(node) => {
                        resultRefs.current[0] = node
                      }}
                      onSelect={() => onOpenChange(false)}
                      result={featuredTitleResult}
                    />
                  ) : null}

                  {compactTitleResults.length > 0 ? (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {compactTitleResults.map((result, index) => {
                        const globalIndex = featuredTitleResult ? index + 1 : index

                        return (
                          <TitleResultRow
                            active={activeIndex === globalIndex}
                            id={resultIds[globalIndex] ?? `global-search-result-${globalIndex}`}
                            key={`${result.mediaType}-${result.id}`}
                            linkRef={(node) => {
                              resultRefs.current[globalIndex] = node
                            }}
                            result={result}
                            onSelect={() => onOpenChange(false)}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {peopleResults.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-kino-muted">
                    {t('search.people')}
                  </div>

                  <div className="grid gap-2 lg:grid-cols-2">
                    {peopleResults.map((result, index) => {
                      const globalIndex =
                        (featuredTitleResult ? 1 : 0) + compactTitleResults.length + index

                      return (
                        <Link
                          aria-selected={activeIndex === globalIndex}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/6',
                            activeIndex === globalIndex && 'bg-white/8'
                          )}
                          href={personPath(result.id, result.name)}
                          id={resultIds[globalIndex] ?? `global-search-result-${globalIndex}`}
                          key={result.id}
                          onClick={() => onOpenChange(false)}
                          ref={(node) => {
                            resultRefs.current[globalIndex] = node
                          }}
                          role="option"
                        >
                          <img
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-full bg-white/6 object-cover ring-1 ring-white/10"
                            src={result.avatarUrl ?? undefined}
                          />

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-kino-text">
                              {result.name}
                            </div>

                            {result.summary ? (
                              <div className="mt-0.5 truncate text-xs text-kino-muted">
                                {result.summary}
                              </div>
                            ) : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {userResults.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-kino-muted">
                    {t('search.users')}
                  </div>

                  <div className="grid gap-2 lg:grid-cols-2">
                    {userResults.map((result, index) => {
                      const globalIndex =
                        (featuredTitleResult ? 1 : 0) +
                        compactTitleResults.length +
                        peopleResults.length +
                        index

                      return (
                        <Link
                          aria-selected={activeIndex === globalIndex}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/6',
                            activeIndex === globalIndex && 'bg-white/8'
                          )}
                          href={`/${result.username}`}
                          id={resultIds[globalIndex] ?? `global-search-result-${globalIndex}`}
                          key={result.id}
                          onClick={() => onOpenChange(false)}
                          ref={(node) => {
                            resultRefs.current[globalIndex] = node
                          }}
                          role="option"
                        >
                          <img
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-full bg-white/6 object-cover ring-1 ring-white/10"
                            src={result.avatarUrl ?? undefined}
                          />

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-kino-text">
                              {result.name}
                            </div>

                            <div className="mt-0.5 truncate text-xs text-kino-muted">
                              {result.username}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {hasResults && query.trim() ? (
                <Link
                  className="
                    mt-4 block
                    border-t border-white/10
                    px-3 pt-4 pb-2
                    text-center text-sm font-medium text-kino-accent
                    transition-colors hover:text-kino-accent-strong
                  "
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => onOpenChange(false)}
                >
                  {t('search.seeAllResults', {
                    query: query.trim(),
                  })}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TitleResultRow({
  active,
  id,
  linkRef,
  result,
  onSelect,
}: {
  active: boolean
  id: string
  linkRef: (node: HTMLAnchorElement | null) => void
  result: Extract<SearchResult, { kind: 'title' }>
  onSelect: () => void
}) {
  const mediaType = result.mediaType === 'tv' ? 'tv' : 'movie'

  return (
    <Link
      aria-selected={active}
      className={cn(
        'group flex min-h-24 items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-white/6',
        active && 'bg-white/8'
      )}
      href={titlePath(result.media.id, result.name, mediaType)}
      id={id}
      onClick={onSelect}
      ref={linkRef}
      role="option"
    >
      <img
        alt=""
        className="h-20 w-14 shrink-0 rounded-md bg-white/6 object-cover ring-1 ring-white/10"
        src={
          result.imagePath
            ? (getTmdb().getImageUrl(result.imagePath, 'w200') ?? undefined)
            : undefined
        }
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold text-kino-text">{result.name}</span>
        </div>

        {result.year ? <div className="mt-1 text-sm text-kino-muted">{result.year}</div> : null}
      </div>
    </Link>
  )
}
