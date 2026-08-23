'use client'

import type { MediaType, TMDbGenre } from '@kino/core'
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { DiscoverFilterState } from '@/components/discover/discover-filters'
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

const RATING_OPTIONS = [0, 5, 6, 7, 8, 9] as const

interface MobileDiscoverFiltersProps {
  genres: TMDbGenre[]
  value: DiscoverFilterState
  onChange: (value: DiscoverFilterState) => void
  onReset: () => void
}

export function MobileDiscoverFilters({
  genres,
  value,
  onChange,
  onReset,
}: MobileDiscoverFiltersProps) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const activeCount =
    Number(value.mediaType !== 'all') +
    Number(value.genreIds.length > 0) +
    Number(value.minRating > 0)

  function setMediaType(mediaType: 'all' | MediaType) {
    onChange({
      ...value,
      mediaType,
    })

    setOpen(false)
  }

  function setMinRating(minRating: number) {
    onChange({
      ...value,
      minRating,
    })

    setOpen(false)
  }

  function toggleGenre(genreId: number) {
    onChange({
      ...value,
      genreIds: value.genreIds.includes(genreId)
        ? value.genreIds.filter((id) => id !== genreId)
        : [...value.genreIds, genreId],
    })
  }

  const mediaTypeLabel =
    value.mediaType === 'movie'
      ? t('search.movies')
      : value.mediaType === 'tv'
        ? t('search.tvShows')
        : t('search.all')

  const genreLabel =
    value.genreIds.length === 0
      ? t('search.genres')
      : value.genreIds.length === 1
        ? t(`genres.${value.genreIds[0]}`, {
            defaultValue:
              genres.find((genre) => genre.id === value.genreIds[0])?.name ?? t('search.genres'),
          })
        : `${t('search.genres')} (${value.genreIds.length})`

  return (
    <div className="md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="secondary">
              <SlidersHorizontal size={15} />
              {t('search.filters')}

              {activeCount > 0 ? (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-kino-accent px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          }
        />

        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('search.filters')}</DialogTitle>
            <DialogDescription>{t('search.filtersDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {/* Media type */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className={cn(
                      'w-full justify-between',
                      value.mediaType !== 'all' && 'border-kino-accent/30 bg-kino-accent/10'
                    )}
                    variant="secondary"
                  />
                }
              >
                <span>{mediaTypeLabel}</span>
                <ChevronDown size={14} />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('search.mediaType')}</DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {(
                    [
                      ['all', t('search.all')],
                      ['movie', t('search.movies')],
                      ['tv', t('search.tvShows')],
                    ] as const
                  ).map(([mediaType, label]) => (
                    <DropdownMenuItem
                      closeOnClick
                      key={mediaType}
                      onClick={() => setMediaType(mediaType)}
                    >
                      <span className="flex-1">{label}</span>

                      {value.mediaType === mediaType ? <Check size={15} /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rating */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className={cn(
                      'w-full justify-between',
                      value.minRating > 0 && 'border-kino-accent/30 bg-kino-accent/10'
                    )}
                    variant="secondary"
                  />
                }
              >
                <span>
                  {value.minRating > 0
                    ? `${t('search.minimumRating')}: ${value.minRating}+`
                    : t('search.minimumRating')}
                </span>

                <ChevronDown size={14} />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('search.minimumRating')}</DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {RATING_OPTIONS.map((rating) => (
                    <DropdownMenuItem
                      closeOnClick
                      key={rating}
                      onClick={() => setMinRating(rating)}
                    >
                      <span className="flex-1">
                        {rating === 0 ? t('search.any') : `${rating}+`}
                      </span>

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
                      'w-full justify-between',
                      value.genreIds.length > 0 && 'border-kino-accent/30 bg-kino-accent/10'
                    )}
                    variant="secondary"
                  />
                }
              >
                <span className="truncate">{genreLabel}</span>
                <ChevronDown size={14} />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                className="
                w-64 overflow-hidden
                border border-white/10
                bg-kino-surface/70
                backdrop-blur-xl
                supports-backdrop-filter:bg-kino-surface/55
              "
              >
                <DropdownMenuGroup>
                  <div className="sticky top-0 z-10 border-b border-white/10 bg-kino-surface/45 backdrop-blur-xl">
                    <DropdownMenuLabel>{t('search.genres')}</DropdownMenuLabel>
                  </div>

                  <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
                    {genres.map((genre) => (
                      <DropdownMenuCheckboxItem
                        checked={value.genreIds.includes(genre.id)}
                        closeOnClick={false}
                        key={genre.id}
                        onCheckedChange={() => toggleGenre(genre.id)}
                        className="
                        bg-transparent
                        focus:bg-white/8
                        data-highlighted:bg-white/8
                        `data-checked:bg-kino-accent/10
                      "
                      >
                        {t(`genres.${genre.id}`, {
                          defaultValue: genre.name,
                        })}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {activeCount > 0 ? (
              <Button
                onClick={() => {
                  onReset()
                  setOpen(false)
                }}
                variant="ghost"
              >
                <RotateCcw size={15} />
                {t('search.resetFilters')}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
