"use client";

import { MediaSection } from "@/components/media/media-section";
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
      ? t("discover.personalized.becauseYouLiked", {
          defaultValue: "Because you liked {{title}}",
          title: rail.seed.title ?? rail.seed.name ?? "",
        })
      : rail.affinityKind === "actor"
        ? t("home.moreWithPerson", {
            defaultValue: "More with {{name}}",
            name: rail.source.name,
          })
        : t("home.moreFromPerson", {
            defaultValue: "More from {{name}}",
            name: rail.source.name,
          });

  return <MediaSection items={rail.items} title={title} />;
}
