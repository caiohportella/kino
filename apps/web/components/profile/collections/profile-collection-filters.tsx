'use client'

import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CollectionSearchInput } from '@/components/collection/collection-search-input'
import { RatingStars } from '@/components/media/rating-stars'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/localization/i18n'
import type { ProfileCollectionFilterState } from '@/lib/profile/profile-collection-filters'
import { cn } from '@/lib/utils'

type FilterOption = {
  label: string
  value: string
}

type ProfileCollectionFiltersProps = {
  activeCount: number
  genres: FilterOption[]
  onChange: (key: keyof ProfileCollectionFilterState, value: string) => void
  onReset: () => void
  state: ProfileCollectionFilterState
  years: string[]
}

const DECADES = Array.from({ length: 13 }, (_, index) => String(2020 - index * 10))

const SORT_GROUPS = [
  { key: 'watchedDate', values: ['watched-desc', 'watched-asc'] },
  { key: 'reviewActivity', values: ['activity-desc', 'activity-asc'] },
  { key: 'diaryCount', values: ['count-desc', 'count-asc'] },
  { key: 'titleName', values: ['title-asc', 'title-desc'] },
  { key: 'popularity', values: ['popularity-desc', 'popularity-asc'] },
  { key: 'releaseDate', values: ['release-desc', 'release-asc'] },
  { key: 'averageRating', values: ['average-desc', 'average-asc'] },
  { key: 'userRating', values: ['rating-desc', 'rating-asc'] },
  { key: 'runtime', values: ['runtime-desc', 'runtime-asc'] },
] as const

export function ProfileCollectionFilters({
  activeCount,
  genres,
  onChange,
  onReset,
  state,
  years,
}: ProfileCollectionFiltersProps) {
  const { t } = useTranslation()

  const [queryDraft, setQueryDraft] = useState(state.query)

  useEffect(() => {
    setQueryDraft(state.query)
  }, [state.query])

  useEffect(() => {
    if (queryDraft === state.query) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onChange('query', queryDraft)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [onChange, queryDraft, state.query])

  const yearOptions = [
    { label: t('diaryFilters.anyYear'), value: 'any' },
    ...years.map((year) => ({
      label: year,
      value: year,
    })),
  ]

  const decadeOptions = [
    { label: t('diaryFilters.anyDecade'), value: 'any' },
    ...DECADES.map((decade) => ({
      label: `${decade}s`,
      value: decade,
    })),
  ]

  const genreOptions = [{ label: t('diaryFilters.anyGenre'), value: 'any' }, ...genres]

  const sortOptions = SORT_GROUPS.flatMap((group) =>
    group.values.map((value) => ({
      label: t(`diaryFilters.sortOptions.${value}`),
      value,
    }))
  )

  const controls = (
    <>
      <RatingFilterDropdown onChange={(value) => onChange('rating', value)} value={state.rating} />

      <FilterDropdown
        active={state.watchType !== 'any'}
        label={t('diaryFilters.watchType')}
        onChange={(value) => onChange('watchType', value)}
        options={[
          {
            label: t('diaryFilters.anyWatchType'),
            value: 'any',
          },
          {
            label: t('diary.firstTime'),
            value: 'first-time',
          },
          {
            label: t('diary.rewatch'),
            value: 'rewatch',
          },
        ]}
        value={state.watchType}
      />

      <FilterDropdown
        active={state.year !== 'any'}
        label={t('diaryFilters.diaryYear')}
        onChange={(value) => onChange('year', value)}
        options={yearOptions}
        value={state.year}
      />

      <FilterDropdown
        active={state.decade !== 'any'}
        label={t('diaryFilters.decade')}
        onChange={(value) => onChange('decade', value)}
        options={decadeOptions}
        value={state.decade}
      />

      <FilterDropdown
        active={state.genre !== 'any'}
        label={t('diaryFilters.genre')}
        onChange={(value) => onChange('genre', value)}
        options={genreOptions}
        value={state.genre}
      />

      <TmdbRatingFilterDropdown
        onChange={(value) => onChange('minTmdbRating', value)}
        value={state.minTmdbRating}
      />

      <SortDropdown
        onChange={(value) => onChange('sort', value)}
        options={sortOptions}
        value={state.sort}
      />
    </>
  )

  return (
    <div className="mb-6 grid gap-3">
      <div className="relative">
        <CollectionSearchInput onChange={setQueryDraft} value={queryDraft} />
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden flex-wrap items-center gap-2 md:flex">{controls}</div>

        <Dialog>
          <DialogTrigger
            render={
              <Button className="md:hidden" size="sm" variant="secondary">
                <SlidersHorizontal data-icon="inline-start" />
                {t('diaryFilters.filters')}

                {activeCount > 0 ? (
                  <span
                    aria-label={t('diaryFilters.activeCount', {
                      count: activeCount,
                    })}
                  >
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            }
          />

          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('diaryFilters.filters')}</DialogTitle>
              <DialogDescription>{t('diaryFilters.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">{controls}</div>

            {activeCount > 0 ? (
              <Button className="hover:bg-transparent" onClick={onReset} variant="ghost">
                <RotateCcw data-icon="inline-start" />
                {t('diaryFilters.reset')}
              </Button>
            ) : null}
          </DialogContent>
        </Dialog>

        {activeCount > 0 ? (
          <Button
            className="hidden hover:bg-transparent md:inline-flex"
            onClick={onReset}
            size="sm"
            variant="ghost"
          >
            <RotateCcw data-icon="inline-start" />
            {t('diaryFilters.reset')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function RatingFilterDropdown({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const { t } = useTranslation()

  const numericValue = value !== 'any' && value !== 'unrated' ? Number(value) : 0

  const selectedLabel =
    value === 'any'
      ? t('diaryFilters.rating')
      : value === 'unrated'
        ? t('diaryFilters.noRating')
        : t('diaryFilters.stars', { count: value })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`${t('diaryFilters.rating')}: ${selectedLabel}`}
            className={cn(
              'w-full justify-between md:w-auto md:min-w-36',
              value !== 'any' &&
                'border-kino-accent bg-kino-accent text-black hover:bg-kino-accent-strong hover:text-black'
            )}
            size="sm"
            variant={value === 'any' ? 'secondary' : 'outline'}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('diaryFilters.rating')}</DropdownMenuLabel>

          <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
            <DropdownMenuRadioItem value="any">{t('diaryFilters.anyRating')}</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="unrated">
              {t('diaryFilters.noRating')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <div className="grid justify-center gap-2 px-3 py-3">
          <RatingStars
            label={t('diaryFilters.rating')}
            onChange={(rating) => onChange(String(rating))}
            size="md"
            value={numericValue}
          />

          <span className="text-center text-xs font-semibold text-kino-muted">
            {numericValue > 0
              ? t('diaryFilters.stars', {
                  count: numericValue,
                })
              : t('diaryFilters.chooseRating')}
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TmdbRatingFilterDropdown({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const { t } = useTranslation()

  const selectedLabel =
    value === 'any' ? t('search.minimumRating') : `${t('search.minimumRating')}: ${value}+`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              'w-full justify-between md:w-auto md:min-w-36',
              value !== 'any' &&
                'border-kino-accent bg-kino-accent text-black hover:bg-kino-accent-strong hover:text-black'
            )}
            size="sm"
            variant={value === 'any' ? 'secondary' : 'outline'}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('search.minimumRating')}</DropdownMenuLabel>

          <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
            <DropdownMenuRadioItem value="any">{t('search.any')}</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="5">5+</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="6">6+</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="7">7+</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="8">8+</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="9">9+</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortDropdown({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void
  options: FilterOption[]
  value: string
}) {
  const { t } = useTranslation()

  const selected = options.find((option) => option.value === value) ?? options[0]!

  const selectedGroup = SORT_GROUPS.find((group) =>
    group.values.some((sortValue) => sortValue === value)
  )

  const selectedLabel = selectedGroup
    ? `${t(`diaryFilters.sortGroups.${selectedGroup.key}`)}: ${selected.label}`
    : selected.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              'w-full justify-between md:w-auto md:min-w-36',
              value !== 'watched-desc' &&
                'border-kino-accent bg-kino-accent text-black hover:bg-kino-accent-strong hover:text-black'
            )}
            size="sm"
            variant="secondary"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />

      <DropdownMenuContent align="start" className="overflow-hidden p-0">
        <div className="max-h-96 overflow-y-auto p-1">
          <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
            {SORT_GROUPS.map((group, index) => (
              <DropdownMenuGroup key={group.key}>
                {index > 0 ? <DropdownMenuSeparator /> : null}

                <DropdownMenuLabel>{t(`diaryFilters.sortGroups.${group.key}`)}</DropdownMenuLabel>

                {group.values.map((sortValue) => (
                  <DropdownMenuRadioItem key={sortValue} value={sortValue}>
                    {options.find((option) => option.value === sortValue)?.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterDropdown({
  active,
  label,
  onChange,
  options,
  value,
}: {
  active: boolean
  label: string
  onChange: (value: string) => void
  options: FilterOption[]
  value: string
}) {
  const selected = options.find((option) => option.value === value) ?? options[0]!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              'w-full justify-between md:w-auto md:min-w-36',
              active &&
                'border-kino-accent bg-kino-accent text-black hover:bg-kino-accent-strong hover:text-black'
            )}
            size="sm"
            variant={active ? 'outline' : 'secondary'}
          >
            <span className="truncate">{active ? selected.label : label}</span>

            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>

          <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
