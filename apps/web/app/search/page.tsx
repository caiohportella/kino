"use client";

import type { MediaType, TMDbGenre, TMDbTitle } from "@kino/core";
import { EmptyState } from "@/components/kino";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { MediaCard } from "@/components/media-card";
import { SearchSkeleton } from "@/components/skeletons/page-skeletons";
import { PageHeader } from "@/components/page-header";
import { getTmdb } from "@/lib/services";
import { useLibraryStore } from "@/stores/library-store";
import { useSettingsStore } from "@/stores/settings-store";

export default function SearchPage() {
  const language = useSettingsStore((state) => state.language);
  const { t } = useTranslation();
  const queryText = useLibraryStore((state) => state.query);
  const setQuery = useLibraryStore((state) => state.setQuery);
  const mediaType = useLibraryStore((state) => state.mediaType);
  const setMediaType = useLibraryStore((state) => state.setMediaType);
  const minRating = useLibraryStore((state) => state.minRating);
  const setMinRating = useLibraryStore((state) => state.setMinRating);
  const genreIds = useLibraryStore((state) => state.genreIds);
  const toggleGenre = useLibraryStore((state) => state.toggleGenre);
  const clearFilters = useLibraryStore((state) => state.clearFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(queryText);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(queryText), 350);
    return () => window.clearTimeout(timeout);
  }, [queryText]);

  const genresQuery = useQuery({
    queryKey: ["genres", language],
    queryFn: async () => {
      const tmdb = getTmdb();
      tmdb.setLanguage(language);
      const [movie, tv] = await Promise.all([
        tmdb.getGenres("movie"),
        tmdb.getGenres("tv"),
      ]);
      const merged = new Map<number, TMDbGenre>();
      for (const genre of [...movie, ...tv]) merged.set(genre.id, genre);
      return Array.from(merged.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    },
  });

  const resultsQuery = useQuery({
    queryKey: [
      "search",
      language,
      debouncedQuery,
      mediaType,
      minRating,
      genreIds.join(","),
    ],
    queryFn: async () => {
      const tmdb = getTmdb();
      tmdb.setLanguage(language);

      if (debouncedQuery.trim()) {
        return (await tmdb.search(debouncedQuery.trim())).results;
      }

      const params: Record<string, string> = { sort_by: "popularity.desc" };
      if (genreIds.length > 0) params.with_genres = genreIds.join(",");
      if (minRating > 0) {
        params["vote_average.gte"] = String(minRating);
        params["vote_count.gte"] = "50";
      }

      const types: MediaType[] =
        mediaType === "all" ? ["movie", "tv"] : [mediaType];
      const responses = await Promise.all(
        types.map((type) => tmdb.discoverMedia(type, params)),
      );
      return responses
        .flat()
        .sort((left, right) => right.vote_average - left.vote_average);
    },
  });

  const filteredResults = useMemo(() => {
    const items = (resultsQuery.data || []).filter(
      (item) => item.media_type === "movie" || item.media_type === "tv",
    );
    return items.filter((item) => {
      if (mediaType !== "all" && item.media_type !== mediaType) return false;
      if (minRating > 0 && item.vote_average < minRating) return false;
      if (
        genreIds.length > 0 &&
        !genreIds.every((id) => item.genre_ids?.includes(id))
      )
        return false;
      return true;
    }) as TMDbTitle[];
  }, [genreIds, mediaType, minRating, resultsQuery.data]);

  return (
    <div className="content-frame">
      <PageHeader
        action={
          <Button
            aria-controls="search-filters"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
            variant="secondary"
          >
            <SlidersHorizontal size={16} />
            {t("search.filters")}
          </Button>
        }
        title={t("search.title")}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label
            className="mb-2 block text-sm font-semibold text-kino-text"
            htmlFor="search"
          >
            {t("search.title")}
          </label>
          <input
            className="min-h-11 w-full rounded-md border border-white/10 bg-kino-surface px-3 text-base text-kino-text outline-none transition-colors placeholder:text-kino-muted/60 focus:border-kino-accent"
            id="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            value={queryText}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={clearFilters} variant="ghost">
            <X size={16} />
            {t("search.clear")}
          </Button>
        </div>
      </div>

      <div
        className={
          showFilters ? "grid gap-6 lg:grid-cols-[280px_1fr]" : "grid gap-6"
        }
      >
        {showFilters ? (
          <aside
            className="grid self-start content-start gap-5 rounded-md border border-white/10 bg-kino-panel p-5"
            id="search-filters"
          >
            <div>
              <div className="mb-2 text-sm font-semibold text-kino-text">
                {t("search.mediaType")}
              </div>
              <SegmentedControl
                onChange={setMediaType}
                options={[
                  { label: t("search.all"), value: "all" },
                  { label: t("search.movies"), value: "movie" },
                  { label: t("search.tvShows"), value: "tv" },
                ]}
                value={mediaType}
              />
            </div>

            <label className="grid gap-2 text-sm text-kino-muted">
              <span className="font-semibold text-kino-text">
                {t("search.minimumRating")}: {minRating || t("search.any")}
              </span>
              <input
                max={9}
                min={0}
                onChange={(event) => setMinRating(Number(event.target.value))}
                step={1}
                type="range"
                value={minRating}
              />
            </label>

            <div>
              <div className="mb-3 text-sm font-semibold text-kino-text">
                {t("search.genres")}
              </div>
              <div className="flex flex-wrap gap-2">
                {(genresQuery.data || []).map((genre) => {
                  const active = genreIds.includes(genre.id);
                  return (
                    <button
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-kino-accent bg-kino-accent text-black"
                          : "border-white/10 bg-white/[0.04] text-kino-muted hover:text-kino-text"
                      }`}
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      type="button"
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}

        <section className="min-w-0">
          {resultsQuery.isLoading ? (
            <SearchSkeleton label={t("search.loading")} />
          ) : null}

          {!resultsQuery.isLoading && filteredResults.length === 0 ? (
            <EmptyState
              body={t("search.noResultsHint")}
              illustrationLabel={t("emptyStates.searchIllustration")}
              title={t("search.noResults")}
              variant="search"
            />
          ) : null}

          <div className="poster-grid">
            {filteredResults.map((item) => (
              <MediaCard item={item} key={`${item.media_type}-${item.id}`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
