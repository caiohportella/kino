import type { TMDbGenre } from "@kino/core";
import type {
  DiscoverCollection,
  DiscoverCollectionId,
  DiscoverCollectionFilters,
} from "./collections.ts";
import { parseDiscoverCollection } from "./collections.ts";

function sanitizeDiscoverFilters(
  params: URLSearchParams,
  genres: TMDbGenre[],
): DiscoverCollectionFilters {
  const rawMediaType = params.get("type");
  const rawGenreIds = params.get("genres");
  const rawRating = Number(params.get("rating"));
  const mediaType =
    rawMediaType === "movie" || rawMediaType === "tv" ? rawMediaType : "all";
  return {
    mediaType,
    genreIds: rawGenreIds
      ? rawGenreIds
          .split(",")
          .map(Number)
          .filter(
            (genreId) =>
              Number.isInteger(genreId) &&
              genres.some((genre) => genre.id === genreId),
          )
      : [],
    minRating:
      Number.isFinite(rawRating) && rawRating >= 0 && rawRating <= 9
        ? rawRating
        : 0,
  };
}

export function readDiscoverUrlState(
  params: URLSearchParams,
  genres: TMDbGenre[],
): {
  filters: DiscoverCollectionFilters;
  collection: DiscoverCollection | null;
  page: number;
} {
  const collection = parseDiscoverCollection(params.get("collection"));
  const rawPage = Number(params.get("page"));

  return {
    filters: sanitizeDiscoverFilters(params, genres),
    collection,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function writeDiscoverFilterUrl(
  current: URLSearchParams,
  next: DiscoverCollectionFilters,
  collection: DiscoverCollection | null,
): string {
  const params = new URLSearchParams(current);
  const filters = normalizeDiscoverFilterState(next, collection);

  params.delete("page");

  if (collection) {
    params.set("collection", collection.id);
  } else {
    params.delete("collection");
  }

  if (filters.mediaType !== "all") {
    params.set("type", filters.mediaType);
  } else {
    params.delete("type");
  }

  if (filters.genreIds.length > 0) {
    params.set("genres", filters.genreIds.join(","));
  } else {
    params.delete("genres");
  }

  if (filters.minRating > 0) {
    params.set("rating", String(filters.minRating));
  } else {
    params.delete("rating");
  }

  return params.toString();
}

export function normalizeDiscoverFilterState(
  next: DiscoverCollectionFilters,
  collection: DiscoverCollection | null,
): DiscoverCollectionFilters {
  if (
    next.mediaType === "all" ||
    !collection ||
    collection.criteria[next.mediaType]
  ) {
    return next;
  }

  return next;
}

export function writeDiscoverCollectionUrl(
  current: URLSearchParams,
  id: DiscoverCollectionId | null,
): string {
  const params = new URLSearchParams(current);

  params.delete("page");

  if (!id) {
    params.delete("collection");

    return params.toString();
  }

  const collection = parseDiscoverCollection(id);

  if (!collection) {
    params.delete("collection");

    return params.toString();
  }

  params.set("collection", collection.id);

  const mediaType = params.get("type");
  const supportedMediaType =
    mediaType === "movie" || mediaType === "tv" ? mediaType : null;

  if (mediaType && !supportedMediaType) {
    params.delete("type");
  }

  return params.toString();
}
