"use client";

import type {
  CarouselTitle,
  TMDbGenre,
  TMDbTitle,
} from "@kino/core";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ActiveDiscoverCollection } from "@/components/discover/active-discover-collection";
import {
  type DiscoverFilterState,
  DiscoverFilters,
} from "@/components/discover/discover-filters";
import { ExploreCollections } from "@/components/discover/explore-collections";
import { PersonalizedDiscoverSection } from "@/components/discover/personalized-discover-section";
import { Poster } from "@/components/kino";
import { useMediaPoster } from "@/hooks/title/use-media-poster";
import { useTranslation } from "@/lib/localization/i18n";
import { getTmdb } from "@/lib/services";
import { TrendingCarousel } from "../carousel/trending-carousel";
import { AppPagination } from "../layout/app-pagination";
import { MediaSection } from "../media/media-section";
import { MobileDiscoverFilters } from "../layout/mobile-discover-filters";
import { getDiscoverCollectionTitle } from "@/lib/discover/discover-localization";
import { mergePopularNow } from "@/lib/discover/presentation";
import { DiscoverSeriesUpdateItem } from "@/lib/discover/series-updates";
import { DiscoverUpdatesSection } from "./discover-updates-section";
import {
  buildDiscoverSectionOrder,
  DiscoverSectionDescriptor,
} from "@/lib/discover/section-ordering";
import {
  type DiscoverCollectionId,
  mergeDiscoverCriteria,
} from "@/lib/discover/collections";
import {
  normalizeDiscoverFilterState,
  readDiscoverUrlState,
  writeDiscoverCollectionUrl,
  writeDiscoverFilterUrl,
} from "@/lib/discover/discover-url-state";
import { getDiscoverDateWindow } from "@/lib/discover/feed-dates";
import type { PersonalizedDiscoverRail } from "@/lib/discover/personalization";

interface DiscoverClientProps {
  genres: TMDbGenre[];
  movieGenres: TMDbGenre[];
  tvGenres: TMDbGenre[];
  trending: CarouselTitle[];
  popularMovies: CarouselTitle[];
  popularTV: CarouselTitle[];
  upcoming: TMDbTitle[];
  rereleases: TMDbTitle[];
  seriesUpdates: DiscoverSeriesUpdateItem[];
  personalizedRails: PersonalizedDiscoverRail[];
  personalizedNewReleases: TMDbTitle[];
  personalizedNewSeries: TMDbTitle[];
}

function DiscoverResultCard({ item }: { item: TMDbTitle }) {
  const { href, poster, prefetch, title, year } = useMediaPoster(item);

  return (
    <Link
      className="group min-w-0 focus-ring"
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <Poster
        className="w-full rounded-md"
        details={{ year }}
        sizes="(max-width: 640px) 45vw, 180px"
        src={poster}
        title={title}
      />
    </Link>
  );
}

export function DiscoverClient({
  genres,
  movieGenres,
  personalizedRails,
  personalizedNewReleases,
  personalizedNewSeries,
  popularMovies,
  popularTV,
  rereleases,
  seriesUpdates,
  trending,
  tvGenres,
  upcoming,
}: DiscoverClientProps) {
  const { t } = useTranslation();

  const popularNow = mergePopularNow(popularMovies, popularTV, 20);

  const sectionOrder: DiscoverSectionDescriptor[] = buildDiscoverSectionOrder({
    primaryKind: "popular",
    updatesCount: seriesUpdates.length,
    affinityRows: [],

    newReleasesCount: personalizedNewReleases.length,

    newSeriesCount: personalizedNewSeries.length,

    upcomingCount: upcoming.length,
    rereleasesCount: rereleases.length,
  });

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialUrlState = useMemo(
    () => readDiscoverUrlState(new URLSearchParams(searchParams), genres),
    [genres, searchParams],
  );

  const [page, setPage] = useState(() => {
    return initialUrlState.page;
  });

  const [activeCollection, setActiveCollection] = useState(
    () => initialUrlState.collection,
  );

  function updatePage(nextPage: number) {
    setPage(nextPage);

    const params = new URLSearchParams(window.location.search);

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }

  function updateCollection(nextId: DiscoverCollectionId | null) {
    const nextQuery = writeDiscoverCollectionUrl(
      new URLSearchParams(window.location.search),
      nextId,
    );
    const nextParams = new URLSearchParams(nextQuery);
    const nextState = readDiscoverUrlState(nextParams, genres);
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    setActiveCollection(nextState.collection);
    setFilters(nextState.filters);
    setPage(nextState.page);

    window.history.replaceState(window.history.state, "", nextUrl);
  }

  const [filters, setFilters] = useState<DiscoverFilterState>(
    () => initialUrlState.filters,
  );

  const filtering =
    activeCollection !== null ||
    filters.mediaType !== "all" ||
    filters.genreIds.length > 0 ||
    filters.minRating > 0;

  const collectionDateWindow = useMemo(() => {
    if (activeCollection?.id !== "new-this-month") {
      return null;
    }

    const { recentStart, today } = getDiscoverDateWindow();

    return {
      start: recentStart,
      end: today,
    };
  }, [activeCollection?.id]);

  const discoverCriteria = useMemo(
    () =>
      mergeDiscoverCriteria({
        collection: activeCollection,
        dateWindow: collectionDateWindow,
        filters,
        page,
      }),
    [activeCollection, collectionDateWindow, filters, page],
  );

  const filteredQuery = useQuery({
    queryKey: ["discover-filtered", discoverCriteria.queryKey],
    queryFn: async () => {
      const tmdb = getTmdb();

      if (discoverCriteria.requests.length === 0) {
        return {
          results: [],
          totalPages: 1,
        };
      }

      const responses = await Promise.all(
        discoverCriteria.requests.map(({ params, type }) =>
          tmdb.discoverMedia(type, params),
        ),
      );

      const results = responses.flatMap((response) => response.results);
      const movieResponseIndex = discoverCriteria.requests.findIndex(
        (request) => request.type === "movie",
      );
      const tvResponseIndex = discoverCriteria.requests.findIndex(
        (request) => request.type === "tv",
      );

      const movieResults =
        movieResponseIndex >= 0
          ? sortResults(responses[movieResponseIndex]?.results ?? [])
          : [];

      const tvResults =
        tvResponseIndex >= 0
          ? sortResults(responses[tvResponseIndex]?.results ?? [])
          : [];

      const hasMovieAndTv = movieResults.length > 0 && tvResults.length > 0;

      const balancedResults: TMDbTitle[] =
        hasMovieAndTv
          ? Array.from({
              length: Math.max(movieResults.length, tvResults.length),
            }).flatMap((_, index) => {
              const items: TMDbTitle[] = [];

              const movie = movieResults[index];
              const tv = tvResults[index];

              if (movie) items.push(movie);
              if (tv) items.push(tv);

              return items;
            })
          : sortResults(results);

      const totalResults = responses.reduce(
        (sum, response) => sum + response.totalResults,
        0,
      );

      const totalPages = Math.max(1, Math.ceil(totalResults / 20));

      function sortResults(items: TMDbTitle[]) {
        if (filters.minRating <= 0) {
          return items;
        }

        return [...items].sort((a, b) => {
          if (a.vote_average !== b.vote_average) {
            return b.vote_average - a.vote_average;
          }

          return b.vote_count - a.vote_count;
        });
      }

      const pagedResults = balancedResults.slice(0, 20);

      return {
        results: pagedResults,
        totalPages,
      };
    },
    enabled: filtering,
  });

  function resetFilters() {
    updateFilters({
      mediaType: "all",
      genreIds: [],
      minRating: 0,
    });
  }

  function updateFilters(next: DiscoverFilterState) {
    const validGenres =
      next.mediaType === "movie"
        ? movieGenres
        : next.mediaType === "tv"
          ? tvGenres
          : genres;

    const validGenreIds = new Set(validGenres.map((genre) => genre.id));

    const sanitized: DiscoverFilterState = {
      ...next,
      genreIds: next.genreIds.filter((id) => validGenreIds.has(id)),
    };
    const effectiveFilters = normalizeDiscoverFilterState(
      sanitized,
      activeCollection,
    );

    setFilters(effectiveFilters);

    setPage(1);

    const params = writeDiscoverFilterUrl(
      new URLSearchParams(window.location.search),
      effectiveFilters,
      activeCollection,
    );

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }

  const selectedGenreNames = filters.genreIds
    .map((id) => {
      const genre = genres.find((item) => item.id === id);

      return t(`genres.${id}`, {
        defaultValue: genre?.name ?? "",
      });
    })
    .filter(Boolean);

  const availableGenres =
    filters.mediaType === "movie"
      ? movieGenres
      : filters.mediaType === "tv"
        ? tvGenres
        : genres;

  const filteredTitle =
    activeCollection
      ? getDiscoverCollectionTitle(t, activeCollection)
      : selectedGenreNames.length > 0
      ? selectedGenreNames.join(", ")
      : filters.mediaType === "movie"
        ? t("search.movies", {
            defaultValue: "Movies",
          })
      : filters.mediaType === "tv"
          ? t("search.tvShows", {
              defaultValue: "TV shows",
            })
          : t("tabs.home", {
              defaultValue: "Home",
            });

  return (
    <>
      <div className="mb-10 flex items-center gap-2">
        {/* Desktop */}
        <div className="hidden md:block">
          <DiscoverFilters
            genres={availableGenres}
            onChange={updateFilters}
            onReset={resetFilters}
            value={filters}
          />
        </div>

        {/* Mobile */}
        <MobileDiscoverFilters
          genres={availableGenres}
          onChange={updateFilters}
          onReset={resetFilters}
          value={filters}
        />
      </div>

      {filtering ? (
        <div className="grid gap-6">
          {activeCollection ? (
            <ActiveDiscoverCollection
              collection={activeCollection}
              onClear={() => updateCollection(null)}
            />
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-kino-text">
                {filteredTitle}
              </h2>
            </div>
          )}

          {filters.minRating > 0 ? (
            <p className="text-sm text-kino-muted">
              {t("search.minimumRating", {
                defaultValue: "Minimum rating",
              })}
              : {filters.minRating}+
            </p>
          ) : null}

          {filteredQuery.isLoading ? (
            <div className="poster-grid">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  className="aspect-2/3 animate-pulse rounded-md bg-white/6"
                  key={index}
                />
              ))}
            </div>
          ) : null}

          {!filteredQuery.isLoading &&
          !filteredQuery.isError &&
          filteredQuery.data?.results.length ? (
            <>
              <div className="poster-grid">
                {filteredQuery.data.results.map((item) => (
                  <DiscoverResultCard
                    item={item}
                    key={`${item.media_type}-${item.id}`}
                  />
                ))}
              </div>

              {filteredQuery.data.totalPages > 1 ? (
                <AppPagination
                  label={t("search.pages")}
                  onPageChange={updatePage}
                  page={page}
                  totalPages={filteredQuery.data.totalPages}
                />
              ) : null}
            </>
          ) : null}

          {!filteredQuery.isLoading &&
          !filteredQuery.isError &&
          !filteredQuery.data?.results.length ? (
            <div className="py-12 text-center text-sm text-kino-muted">
              {t("search.noResults")}
            </div>
          ) : null}

          {filteredQuery.isError ? (
            <div className="py-12 text-center text-sm text-kino-muted">
              {t("common.failed")}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <section className="mb-12 lg:mb-14">
            <TrendingCarousel items={trending} />
          </section>

          {sectionOrder.map((section) => {
            switch (section.type) {
              case "primary":
                return (
                  <MediaSection
                    density="comfortable"
                    items={popularNow}
                    key="primary"
                    title={t("home.popularNow", {
                      defaultValue: "Popular now",
                    })}
                  />
                );

              case "updates":
                return (
                  <DiscoverUpdatesSection items={seriesUpdates} key="updates" />
                );

              case "affinity":
                return null;

              case "new-releases":
                return (
                  <MediaSection
                    density="comfortable"
                    items={personalizedNewReleases}
                    key="new-releases"
                    title={t("home.newReleases", {
                      defaultValue: "New releases",
                    })}
                  />
                );

              case "new-series":
                return (
                  <MediaSection
                    density="comfortable"
                    items={personalizedNewSeries}
                    key="new-series"
                    title={t("home.newSeries", {
                      defaultValue: "New series",
                    })}
                  />
                );

              case "upcoming":
                return (
                  <MediaSection
                    density="comfortable"
                    items={upcoming}
                    key="upcoming"
                    title={t("home.upcoming", {
                      defaultValue: "Coming soon",
                    })}
                  />
                );

              case "rereleases":
                return (
                  <MediaSection
                    density="comfortable"
                    items={rereleases}
                    key="rereleases"
                    title={t("home.rereleases", {
                      defaultValue: "Back in theaters",
                    })}
                  />
                );

              default:
                return null;
            }
          })}

          <PersonalizedDiscoverSection rails={personalizedRails} />

          <ExploreCollections onSelect={updateCollection} />
        </>
      )}
    </>
  );
}
