'use client'

import type { TMDbTitle } from '@kino/core'
import { ChevronLeft } from 'lucide-react'
import type { DiscoverCollection } from '@/lib/discover/collections'
import {
  getDiscoverCollectionActiveLabel,
  getDiscoverCollectionDescription,
  getDiscoverCollectionTitle,
} from '@/lib/discover/discover-localization'
import { useTranslation } from '@/lib/localization/i18n'
import { getTmdb } from '@/lib/services'

export function ActiveDiscoverCollection({
  collection,
  hero,
  onClearAction,
}: {
  collection: DiscoverCollection
  hero: TMDbTitle | null
  onClearAction: () => void
}) {
  const { t } = useTranslation()

  const title = getDiscoverCollectionTitle(t, collection)

  const description = getDiscoverCollectionDescription(t, collection)

  const eyebrow = getDiscoverCollectionActiveLabel(t)

  const backdropUrl = hero?.backdrop_path
    ? getTmdb().getBackdropUrl(hero.backdrop_path, 'w1280')
    : null

  const posterUrl = hero?.poster_path ? getTmdb().getImageUrl(hero.poster_path, 'w300') : null

  return (
    <div className="min-w-0">
      <button
        className="focus-ring mb-3 inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-kino-muted transition-colors hover:text-kino-text"
        onClick={onClearAction}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />

        {t('common.back', {
          defaultValue: 'Back',
        })}
      </button>

      <section className="relative min-h-84 overflow-hidden rounded-2xl border border-white/10 bg-[#171717] sm:min-h-92">
        {backdropUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
            src={backdropUrl}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.07),transparent_45%)]"
          />
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.82)_30%,rgba(0,0,0,0.28)_65%,rgba(0,0,0,0.48)_100%)]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-black/20"
        />

        <div className="relative z-10 flex min-h-84 items-end px-5 pb-6 pt-10 sm:min-h-92 sm:px-8 sm:pb-8">
          <div className="flex max-w-4xl items-end gap-5 sm:gap-7">
            <div className="hidden shrink-0 sm:block">
              {posterUrl ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="h-40 w-[6.7rem] rounded-lg object-cover shadow-[0_16px_36px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
                  src={posterUrl}
                />
              ) : (
                <div className="flex h-40 w-[6.7rem] items-end rounded-lg bg-white/6 p-3 ring-1 ring-white/10">
                  <span className="text-xs font-semibold leading-tight text-white/70">{title}</span>
                </div>
              )}
            </div>

            <div className="min-w-0 pb-0.5">
              <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kino-accent">
                {eyebrow}
              </p>

              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[0.98]">
                {title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">{description}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
