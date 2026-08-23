import type { CarouselTitle } from '@kino/core'
import { getDisplayTitle, getReleaseYear, getTMDbImageUrl } from '@kino/core'
import Image from 'next/image'
import Link from 'next/link'

import { useTranslation } from '@/lib/localization/i18n'
import { titlePath } from '@/lib/routes'

type CarouselSlideProps = {
  active: boolean
  item: CarouselTitle
}

export function CarouselSlide({ active, item }: CarouselSlideProps) {
  const { t } = useTranslation()

  const title = getDisplayTitle(item)
  const year = getReleaseYear(item)
  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  const href = titlePath(item.id, title, type)

  const image =
    getTMDbImageUrl(item.backdrop_path ?? item.poster_path, 'original') ?? '/placeholder.jpg'

  const overview = item.overview?.trim()
  const rating =
    Number.isFinite(item.vote_average) && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null

  return (
    <div className="h-full w-full shrink-0 grow-0 basis-full">
      <Link
        aria-hidden={!active}
        className="relative block h-full w-full overflow-hidden"
        draggable={false}
        href={href}
        tabIndex={active ? 0 : -1}
      >
        <div className="absolute inset-0" data-parallax-layer>
          <div className="relative h-full w-[120%] translate-x-[-10%]">
            <Image
              alt={title}
              className="object-cover"
              draggable={false}
              fill
              priority={active}
              sizes="100vw"
              src={image}
            />
          </div>
        </div>

        {/* Make the left content column readable without hiding the artwork. */}
        <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/5" />

        <div className="absolute inset-0 flex items-end">
          <div
            className="
              w-full
              px-6 pb-16
              sm:px-8 sm:pb-18
              lg:px-12 lg:pb-20
            "
          >
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className="
                    rounded-md bg-kino-accent
                    px-2 py-1
                    text-xs font-bold uppercase tracking-wide text-black
                  "
                >
                  {type === 'tv' ? t('common.tv') : t('common.movie')}
                  {year ? ` · ${year}` : ''}
                </span>

                {rating ? (
                  <span className="text-sm font-medium text-white/70">TMDB {rating}</span>
                ) : null}
              </div>

              <h3
                className="
                  max-w-[18ch]
                  text-3xl font-bold leading-[0.98] tracking-tight text-white
                  sm:text-4xl
                  lg:text-5xl
                  xl:text-6xl
                "
              >
                {title}
              </h3>

              {overview ? (
                <p
                  className="
                    mt-5
                    hidden max-w-2xl
                    text-base leading-7 text-white/70
                    sm:line-clamp-2 sm:block
                    lg:line-clamp-3 lg:text-lg
                  "
                >
                  {overview}
                </p>
              ) : null}

              <div className="mt-6">
                <span
                  className="
                    inline-flex h-10 items-center justify-center
                    rounded-md border border-white/15
                    bg-white/10 px-5
                    text-sm font-semibold text-white
                    backdrop-blur-md
                    transition-colors
                    group-hover/carousel:bg-white/15
                  "
                >
                  {t('common.details', {
                    defaultValue: 'Detalhes',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
