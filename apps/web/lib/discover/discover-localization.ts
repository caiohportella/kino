import type { DiscoverCollection } from "./collections";
import type { TFunction } from "../localization/i18n";

export function getDiscoverForYouLabel(t: TFunction) {
  return t("discover.forYou", {
    defaultValue: "For You",
  });
}

export function getDiscoverExploreCollectionsLabel(t: TFunction) {
  return t("discover.exploreCollections", {
    defaultValue: "Explore collections",
  });
}

export function getDiscoverExploreCollectionsDescription(t: TFunction) {
  return t("discover.collections.explore.description", {
    defaultValue:
      "Editorial picks for nights when you want a strong starting point.",
  });
}

export function getDiscoverCollectionTitle(
  t: TFunction,
  collection: DiscoverCollection,
) {
  switch (collection.id) {
    case "hidden-gems":
      return t("discover.collections.hiddenGems.title", {
        defaultValue: "Hidden Gems",
      });
    case "quick-watch":
      return t("discover.collections.quickWatch.title", {
        defaultValue: "Quick Watch",
      });
    case "90s-essentials":
      return t("discover.collections.ninetiesEssentials.title", {
        defaultValue: "90s Essentials",
      });
    case "modern-classics":
      return t("discover.collections.modernClassics.title", {
        defaultValue: "Modern Classics",
      });
    case "critically-acclaimed":
      return t("discover.collections.criticallyAcclaimed.title", {
        defaultValue: "Critically Acclaimed",
      });
    case "something-weird":
      return t("discover.collections.somethingWeird.title", {
        defaultValue: "Something Weird",
      });
    case "new-this-month":
      return t("discover.collections.newThisMonth.title", {
        defaultValue: "New This Month",
      });
  }
}

export function getDiscoverCollectionDescription(
  t: TFunction,
  collection: DiscoverCollection,
) {
  switch (collection.id) {
    case "hidden-gems":
      return t("discover.collections.hiddenGems.description", {
        defaultValue: "Highly rated titles you may have missed",
      });
    case "quick-watch":
      return t("discover.collections.quickWatch.description", {
        defaultValue: "Great movies under 100 minutes",
      });
    case "90s-essentials":
      return t("discover.collections.ninetiesEssentials.description", {
        defaultValue: "Essential titles from the 1990s",
      });
    case "modern-classics":
      return t("discover.collections.modernClassics.description", {
        defaultValue: "Beloved titles from 2000 to 2019",
      });
    case "critically-acclaimed":
      return t("discover.collections.criticallyAcclaimed.description", {
        defaultValue: "Widely praised titles with a lasting reputation",
      });
    case "something-weird":
      return t("discover.collections.somethingWeird.description", {
        defaultValue: "Unusual, underseen titles worth discovering",
      });
    case "new-this-month":
      return t("discover.collections.newThisMonth.description", {
        defaultValue: "Recent releases from your region",
      });
  }
}

export function getDiscoverCollectionClearLabel(t: TFunction) {
  return t("discover.collections.clear", {
    defaultValue: "Clear collection",
  });
}

export function getDiscoverCollectionActiveLabel(t: TFunction) {
  return t("discover.collections.active.label", {
    defaultValue: "Collection",
  });
}

export function getDiscoverCollectionOpenLabel(t: TFunction) {
  return t("discover.collections.open", {
    defaultValue: "Open collection",
  });
}

export function getDiscoverBecauseYouLikedLabel(
  t: TFunction,
  title: string,
) {
  return t("discover.personalized.becauseYouLiked", {
    defaultValue: "Because you liked {{title}}",
    title,
  });
}

export function getDiscoverMoreFromDirectorsLabel(
  t: TFunction,
  name: string,
) {
  return t("discover.personalized.moreFromDirectors", {
    defaultValue: "More from {{name}}",
    name,
  });
}

export function getDiscoverExploreMoreGenreLabel(
  t: TFunction,
  genre: string,
) {
  return t("discover.personalized.exploreMoreGenre", {
    defaultValue: "Explore more {{genre}}",
    genre,
  });
}

export function getDiscoverPopularAmongFollowingLabel(t: TFunction) {
  return t("discover.personalized.popularAmongFollowing", {
    defaultValue: "Popular among people you follow",
  });
}
