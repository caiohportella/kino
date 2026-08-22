"use client";

import { getDiscoverForYouLabel } from "@/lib/discover/discover-localization";
import { useTranslation } from "@/lib/localization/i18n";
import {
  type PersonalizedDiscoverRail as PersonalizedDiscoverRailData,
} from "@/lib/discover/personalization";
import { getVisibleDiscoverPersonalizedRails } from "@/lib/discover/presentation";
import { PersonalizedDiscoverRail } from "./personalized-discover-rail";

export function PersonalizedDiscoverSection({
  rails,
}: {
  rails: PersonalizedDiscoverRailData[];
}) {
  const { t } = useTranslation();
  const visibleRails = getVisibleDiscoverPersonalizedRails(rails);

  if (visibleRails.length === 0) {
    return null;
  }

  return (
    <section className="mb-12 lg:mb-14">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-kino-text lg:text-2xl">
          {getDiscoverForYouLabel(t)}
        </h2>
      </div>

      <div>
        {visibleRails.map((rail) => (
          <PersonalizedDiscoverRail
            key={
              rail.kind === "because-you-liked"
                ? `because-you-liked:${rail.seed.media_type}:${rail.seed.id}`
                : `affinity:${rail.affinityKind}:${rail.source.id}`
            }
            rail={rail}
          />
        ))}
      </div>
    </section>
  );
}
