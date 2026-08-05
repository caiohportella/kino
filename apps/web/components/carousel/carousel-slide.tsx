import type { CarouselTitle } from "@kino/core";
import { getDisplayTitle, getReleaseYear, getTMDbImageUrl } from "@kino/core";
import Image from "next/image";
import Link from "next/link";

import { titlePath } from "@/lib/routes";

type CarouselSlideProps = {
  active: boolean;
  item: CarouselTitle;
};

export function CarouselSlide({ active, item }: CarouselSlideProps) {
  const title = getDisplayTitle(item);
  const year = getReleaseYear(item);
  const type = item.media_type === "tv" ? "tv" : "movie";
  const image =
    getTMDbImageUrl(item.backdrop_path ?? item.poster_path, "original") ??
    "/placeholder.jpg";

  return (
    <div className="h-full w-full shrink-0 grow-0 basis-full">
      <Link
        aria-hidden={!active}
        className="relative block h-full w-full overflow-hidden"
        draggable={false}
        href={titlePath(item.id, title, type)}
        tabIndex={active ? 0 : -1}
      >
        <div className="absolute inset-0" data-parallax-layer>
          <div className="relative h-full w-[130%] translate-x-[-15%]">
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

        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-kino-muted">
            {type === "tv" ? "Series" : "Movie"} · {year || "TBA"}
          </p>

          <h3 className="max-w-xl text-2xl font-bold text-white sm:text-3xl">
            {title}
          </h3>
        </div>
      </Link>
    </div>
  );
}
