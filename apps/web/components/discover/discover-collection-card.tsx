"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import type { DiscoverCollection, DiscoverCollectionId } from "@/lib/discover/collections";
import {
  getDiscoverCollectionDescription,
  getDiscoverCollectionTitle,
} from "@/lib/discover/discover-localization";
import { useTranslation } from "@/lib/localization/i18n";
import { ChevronRight } from "lucide-react";

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function DiscoverCollectionCard({
  collection,
  href,
  onSelect,
}: {
  collection: DiscoverCollection;
  href: string;
  onSelect: (id: DiscoverCollectionId) => void;
}) {
  const { t } = useTranslation();

  return (
    <Link
      className="group focus-ring block min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-white/18 hover:bg-white/[0.055] sm:p-4.5"
      href={href}
      onClick={(event) => {
        if (event.defaultPrevented || isModifiedEvent(event)) {
          return;
        }

        event.preventDefault();
        onSelect(collection.id);
      }}
    >
      <div className="flex min-h-32 flex-col justify-between gap-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-kino-text">
            {getDiscoverCollectionTitle(t, collection)}
          </h3>

          <p className="text-sm leading-6 text-kino-muted">
            {getDiscoverCollectionDescription(t, collection)}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-kino-text transition-colors group-hover:text-kino-accent">
          <span>
            {t("discover.collections.open", {
              defaultValue: "Open collection",
            })}
          </span>

          <ChevronRight aria-hidden="true" className="size-4" />
        </div>
      </div>
    </Link>
  );
}
