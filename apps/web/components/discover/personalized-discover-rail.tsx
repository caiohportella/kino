"use client";

import { MediaSection } from "@/components/media/media-section";
import {
  getDiscoverBecauseYouLikedLabel,
  getDiscoverMoreFromDirectorsLabel,
} from "@/lib/discover/discover-localization";
import { useTranslation } from "@/lib/localization/i18n";
import type { PersonalizedDiscoverRail as PersonalizedDiscoverRailData } from "@/lib/discover/personalization";

export function PersonalizedDiscoverRail({
  rail,
}: {
  rail: PersonalizedDiscoverRailData;
}) {
  const { t } = useTranslation();

  const title =
    rail.kind === "because-you-liked"
      ? getDiscoverBecauseYouLikedLabel(
          t,
          rail.seed.title ?? rail.seed.name ?? "",
        )
      : rail.affinityKind === "actor"
        ? t("home.moreWithPerson", {
            defaultValue: "More with {{name}}",
            name: rail.source.name,
          })
        : rail.affinityKind === "director"
          ? getDiscoverMoreFromDirectorsLabel(t, rail.source.name)
          : t("home.moreFromPerson", {
              defaultValue: "More from {{name}}",
              name: rail.source.name,
            });

  return <MediaSection items={rail.items} title={title} />;
}
