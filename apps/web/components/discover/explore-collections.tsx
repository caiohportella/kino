"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { MediaRow } from "@/components/media/media-row";
import {
  DISCOVER_COLLECTIONS,
  type DiscoverCollectionId,
} from "@/lib/discover/collections";
import { writeDiscoverCollectionUrl } from "@/lib/discover/discover-url-state";
import { useTranslation } from "@/lib/localization/i18n";
import { DiscoverCollectionCard } from "./discover-collection-card";

export function ExploreCollections({
  onSelect,
}: {
  onSelect: (id: DiscoverCollectionId) => void;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch =
    typeof window === "undefined"
      ? searchParams.toString()
      : window.location.search;
  const currentParams = new URLSearchParams(currentSearch);

  return (
    <section className="mb-10 border-t border-white/8 pt-7">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-kino-text">
          {t("discover.collections.explore.title", {
            defaultValue: "Explore collections",
          })}
        </h2>

        <p className="mt-1 text-sm text-kino-muted">
          {t("discover.collections.explore.description", {
            defaultValue: "Editorial picks for nights when you want a strong starting point.",
          })}
        </p>
      </div>

      <MediaRow className="px-0" overflowAware>
        {DISCOVER_COLLECTIONS.map((collection) => (
          <div className="w-[min(80vw,270px)] sm:w-[250px] lg:w-[228px]" key={collection.id}>
            <DiscoverCollectionCard
              collection={collection}
              href={
                (() => {
                  const query = writeDiscoverCollectionUrl(
                    currentParams,
                    collection.id,
                  );

                  return query ? `${pathname}?${query}` : pathname;
                })()
              }
              onSelect={onSelect}
            />
          </div>
        ))}
      </MediaRow>
    </section>
  );
}
