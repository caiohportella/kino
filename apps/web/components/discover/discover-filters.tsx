'use client'

import type { MediaType, TMDbGenre } from '@kino/core'
import { Check, ChevronDown, Film, RotateCcw, SlidersHorizontal, Star, Tags } from 'lucide-react'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/localization/i18n'
import { cn } from '@/lib/utils'

export interface DiscoverFilterState {
  mediaType: 'all' | MediaType
  genreIds: number[]
  minRating: number
}

interface DiscoverFiltersProps {
  genres: TMDbGenre[]
  value: DiscoverFilterState
  onChange: (value: DiscoverFilterState) => void
  onReset: () => void
}

const RATING_OPTIONS = [0, 5, 6, 7, 8, 9] as const

export function DiscoverFilters({ genres, value, onChange, onReset }: DiscoverFiltersProps) {
  const { t } = useTranslation()

  const setMediaType = (mediaType: 'all' | MediaType) => {
    onChange({
      ...value,
      mediaType,
    })
  }

  const setMinRating = (minRating: number) => {
    onChange({
      ...value,
      minRating,
    })
  }

  const toggleGenre = (genreId: number) => {
    const selected = value.genreIds.includes(genreId)

    onChange({
      ...value,
      genreIds: selected
        ? value.genreIds.filter((id) => id !== genreId)
        : [...value.genreIds, genreId],
    })
  }

  const clearGenres = () => {
    onChange({
      ...value,
      genreIds: [],
    })
  }

  const activeCount =
    Number(value.mediaType !== 'all') +
    Number(value.genreIds.length > 0) +
    Number(value.minRating > 0)

  const mediaTypeLabel =
    value.mediaType === 'movie'
      ? t('search.movies')
      : value.mediaType === 'tv'
        ? t('search.tvShows')
        : t('search.all')

  const ratingLabel = value.minRating > 0 ? `${value.minRating}+` : t('search.any')

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Media type */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                'gap-2',
                value.mediaType !== 'all' && 'border-kino-accent/30 bg-kino-accent/10'
              )}
              size="sm"
              variant="secondary"
            />
          }
        >
          <Film size={15} />

          <span>{mediaTypeLabel}</span>

          <ChevronDown className="text-kino-muted" size={14} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('search.mediaType')}</DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem closeOnClick onClick={() => setMediaType('all')}>
              <span className="flex-1">{t('search.all')}</span>

              {value.mediaType === 'all' ? <Check size={15} /> : null}
            </DropdownMenuItem>

            <DropdownMenuItem closeOnClick onClick={() => setMediaType('movie')}>
              <span className="flex-1">{t('search.movies')}</span>

              {value.mediaType === 'movie' ? <Check size={15} /> : null}
            </DropdownMenuItem>

            <DropdownMenuItem closeOnClick onClick={() => setMediaType('tv')}>
              <span className="flex-1">{t('search.tvShows')}</span>

              {value.mediaType === 'tv' ? <Check size={15} /> : null}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Minimum rating */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                'gap-2',
                value.minRating > 0 && 'border-kino-accent/30 bg-kino-accent/10'
              )}
              size="sm"
              variant="secondary"
            />
          }
        >
          <Star size={15} />

          <span>
            {value.minRating > 0
              ? `${t('search.minimumRating')}: ${ratingLabel}`
              : t('search.minimumRating')}
          </span>

          <ChevronDown className="text-kino-muted" size={14} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('search.minimumRating')}</DropdownMenuLabel>

            <DropdownMenuSeparator />

            {RATING_OPTIONS.map((rating) => (
              <DropdownMenuItem closeOnClick key={rating} onClick={() => setMinRating(rating)}>
                <span className="flex-1">{rating === 0 ? t('search.any') : `${rating}+`}</span>

                {value.minRating === rating ? <Check size={15} /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Genres */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                'gap-2',
                value.genreIds.length > 0 && 'border-kino-accent/30 bg-kino-accent/10'
              )}
              size="sm"
              variant="secondary"
            />
          }
        >
          <Tags size={15} />

          <span className="max-w-40 truncate">
            {value.genreIds.length === 0
              ? t('search.genres')
              : value.genreIds.length === 1
                ? t(`genres.${value.genreIds[0]}`, {
                    defaultValue:
                      genres.find((genre) => genre.id === value.genreIds[0])?.name ??
                      t('search.genres'),
                  })
                : `${t('search.genres')} (${value.genreIds.length})`}
          </span>

          <ChevronDown className="text-kino-muted" size={14} />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="
            max-h-80 w-60 overflow-hidden
            border-white/10
            bg-kino-surface/90
            backdrop-blur-xl
          "
        >
          <DropdownMenuGroup>
            <div className="sticky top-0 z-10 bg-kino-surface/80 backdrop-blur-xl">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">{t('search.genres')}</DropdownMenuLabel>

                {value.genreIds.length > 0 ? (
                  <button
                    className="text-xs font-medium text-kino-muted transition-colors hover:text-kino-text"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      clearGenres()
                    }}
                    type="button"
                  >
                    {t('common.clear')}
                  </button>
                ) : null}
              </div>

              <DropdownMenuSeparator />
            </div>

            <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
              {genres.map((genre) => {
                const checked = value.genreIds.includes(genre.id)

                return (
                  <DropdownMenuCheckboxItem
                    checked={checked}
                    closeOnClick={false}
                    key={genre.id}
                    onCheckedChange={() => toggleGenre(genre.id)}
                  >
                    {t(`genres.${genre.id}`, {
                      defaultValue: genre.name,
                    })}
                  </DropdownMenuCheckboxItem>
                )
              })}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeCount > 0 ? (
        <Button className="hover:bg-transparent" onClick={onReset} size="sm" variant="ghost">
          <RotateCcw size={15} />
          {t('search.resetFilters')}
        </Button>
      ) : null}
    </div>
  )
}
