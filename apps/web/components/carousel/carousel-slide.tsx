import Image from "next/image";
import type { CarouselTitle } from "@kino/core";
import { getDisplayTitle, getReleaseYear, getTMDbImageUrl } from "@kino/core";
import Link from "next/link";
import { titlePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function CarouselSlide({
  active,
  item,
}: {
  active: boolean;
  item: CarouselTitle;
}) {
  const title = getDisplayTitle(item);
  const year = getReleaseYear(item);

  const type = item.media_type === "tv" ? "tv" : "movie";

  const image =
    getTMDbImageUrl(item.backdrop_path ?? item.poster_path, "original") ??
    "/placeholder.jpg";

  return (
    <Link
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 transition-opacity duration-700 ease-out",
        active
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      href={titlePath(item.id, title, type)}
      tabIndex={active ? 0 : -1}
    >
      <Image
        alt={title}
        className="object-cover"
        fill
        priority={active}
        sizes="100vw"
        src={image}
      />

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
  );
}
