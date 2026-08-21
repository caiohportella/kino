"use client";

import type { DiscoverCollection } from "@/lib/discover/collections";
import { useTranslation } from "@/lib/localization/i18n";

export function ActiveDiscoverCollection({
  collection,
  onClear,
}: {
  collection: DiscoverCollection;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-xl border border-white/10 bg-kino-surface/90 p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-kino-subtle">
            {t("discover.collections.active.label", {
              defaultValue: "Collection",
            })}
          </p>

          <h2 className="mt-2 text-xl font-semibold text-kino-text">
            {t(collection.titleKey, {
              defaultValue: collection.defaultTitle,
            })}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-kino-muted">
            {t(collection.descriptionKey, {
              defaultValue: collection.defaultDescription,
            })}
          </p>
        </div>

        <button
          className="focus-ring inline-flex min-h-10 items-center justify-center self-start rounded-md border border-white/10 bg-white/4 px-3 text-sm font-medium text-kino-muted transition-colors hover:border-white/20 hover:bg-white/6 hover:text-kino-text"
          onClick={onClear}
          type="button"
        >
          {t("discover.collections.clear", {
            defaultValue: "Clear collection",
          })}
        </button>
      </div>
    </section>
  );
}
