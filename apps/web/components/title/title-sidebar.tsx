"use client";

import type { TitleDetails, TitleRatingStats, TMDbCast } from "@kino/core";
import { getTMDbImageUrl } from "@kino/core";
import Link from "next/link";
import {
  type ExternalLinkProvider,
  ExternalLinksSection,
} from "@/components/external-links-section";
import { Card } from "@/components/ui/card";
import {
  TrailerCard,
  WatchProvidersCard,
  type TitleContextData,
} from "@/components/title-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { personPath } from "@/lib/routes";
import { CommunityRatingsPanel } from "@/components/title/title-metadata";

const EXTERNAL_LOGOS = {
  letterboxd: "https://a.ltrbxd.com/logos/letterboxd-decal-dots-neg-rgb.svg",
  tmdb: "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg",
  seriesGraph:
    "https://seriesgraph.com/_next/image?url=https:%2F%2Fimages.seriesgraph.com%2Ffictional-posters%2F2e65671e-4c85-40a1-b184-44be9a8153a5-10ba660c-a406-42fc-aee1-74f87f822aca-1779031627029.jpg&w=1080&q=75",
} as const;

export function TitleSidebar({
  title,
  contextQuery,
  stats,
}: {
  title: TitleDetails;
  contextQuery: {
    data: TitleContextData | undefined;
    isLoading: boolean;
    isError: boolean;
  };
  stats: TitleRatingStats | undefined;
}) {
  return (
    <aside className="title-sidebar grid w-full min-w-0 max-w-full content-start gap-5">
      <div className="order-1">
        <TrailerCard
          error={contextQuery.data?.errors.trailer || contextQuery.isError}
          loading={contextQuery.isLoading}
          title={title.title}
          trailer={contextQuery.data?.trailer}
        />
      </div>
      <div className="order-2">
        <WatchProvidersCard
          error={contextQuery.data?.errors.providers || contextQuery.isError}
          loading={contextQuery.isLoading}
          media={{
            mediaType: title.type,
            releaseYear: title.year,
            title: title.title,
            tmdbId: title.tmdbId,
          }}
          providers={contextQuery.data?.providers}
        />
      </div>
      <div className="order-3">
        <ExternalLinksPanel title={title} />
      </div>
      {title.type === "tv" ? (
        <div className="order-4">
          <CommunityRatingsPanel
            showFollowed={false}
            stats={stats}
            titleId={title.id}
            type={title.type}
          />
        </div>
      ) : null}
      <div className="order-5">
        <CreditsPanel title={title} />
      </div>
    </aside>
  );
}

function ExternalLinksPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation();
  return (
    <Card className="p-5" size="sm">
      <ExternalLinksSection
        compact
        providers={getTitleExternalLinks(title)}
        title={t("title.seeAlsoOn")}
      />
    </Card>
  );
}

function getTitleExternalLinks(title: TitleDetails): ExternalLinkProvider[] {
  const links: ExternalLinkProvider[] = [];

  if (title.externalIds?.imdb_id) {
    links.push({
      href: `https://www.imdb.com/title/${title.externalIds.imdb_id}`,
      brandColor: "#f5c518",
      iconUrl: "/external/imdb.png",
      label: "IMDb",
    });
  }

  links.push({
    href: `https://www.themoviedb.org/${title.type === "tv" ? "tv" : "movie"}/${title.tmdbId}`,
    brandColor: "#01b4e4",
    iconUrl: EXTERNAL_LOGOS.tmdb,
    label: "TMDB",
  });

  if (title.type === "movie") {
    links.push({
      href: `https://letterboxd.com/tmdb/${title.tmdbId}`,
      brandColor: "#00e054",
      iconUrl: EXTERNAL_LOGOS.letterboxd,
      label: "Letterboxd",
    });
  }

  if (title.type === "tv") {
    links.push({
      href: `https://seriesgraph.com/show/${title.tmdbId}`,
      brandColor: "#411052",
      iconUrl: EXTERNAL_LOGOS.seriesGraph,
      label: "SeriesGraph",
    });
  }

  return links;
}

function CreditsPanel({ title }: { title: TitleDetails }) {
  const { t } = useTranslation();
  const directorLabel =
    title.type === "tv" ? t("title.creator") : t("title.director");
  const cast = title.cast.slice(0, 5);
  const hasMoreCast = title.cast.length > cast.length;

  if (!title.director && cast.length === 0) return null;

  return (
    <Card className="grid gap-4 p-5" size="sm">
      <h2 className="text-lg font-semibold text-kino-text">
        {t("title.credits")}
      </h2>

      {title.director ? (
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase text-kino-subtle">
            {directorLabel}
          </h3>
          <CreditPersonLink
            person={title.director}
            roleLabel={title.director.job || directorLabel}
          />
        </section>
      ) : null}

      {cast.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase text-kino-subtle">
            {t("title.topCast")}
          </h3>
          <div className="grid gap-2">
            {cast.map((person) => (
              <CreditPersonLink
                key={`${person.id}-${person.character || person.name}`}
                person={person}
                roleLabel={person.character}
              />
            ))}
          </div>
          {hasMoreCast ? (
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    className="justify-start px-0"
                    size="sm"
                    variant="ghost"
                  >
                    {t("title.seeFullCast")}
                  </Button>
                }
              />
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {t("title.fullCastFor", { title: title.title })}
                  </DialogTitle>
                  <DialogDescription>
                    {t("title.fullCastDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid max-h-[65vh] gap-2 overflow-y-auto sm:grid-cols-2">
                  {title.cast.map((person) => (
                    <CreditPersonLink
                      key={`${person.id}-${person.character || person.name}`}
                      person={person}
                      roleLabel={person.character}
                    />
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}

function CreditPersonLink({
  person,
  roleLabel,
}: {
  person: TMDbCast;
  roleLabel?: string;
}) {
  const { t } = useTranslation();
  const avatar = getTMDbImageUrl(person.profile_path, "w200");
  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      aria-label={t("title.viewPersonProfile", { name: person.name })}
      className="focus-ring group flex min-w-0 items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-white/5"
      href={personPath(person.id, person.name)}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white/6 text-xs font-bold text-kino-muted">
        {avatar ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            src={avatar}
          />
        ) : (
          initials
        )}
      </div>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-kino-text group-hover:text-kino-accent">
          {person.name}
        </span>
        {roleLabel ? (
          <span className="block truncate text-xs text-kino-muted">
            {roleLabel}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
