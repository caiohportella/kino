import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import extractKinoTranslations from "../../../../../scripts/tolgee-extractor.mjs";

const englishUrl = new URL(
  "../../../../../packages/i18n/generated/en-GB.json",
  import.meta.url,
);

const discoverCollectionsUrl = new URL(
  "../../discover/collections.ts",
  import.meta.url,
);
const discoverLocalizationUrl = new URL(
  "../../discover/discover-localization.ts",
  import.meta.url,
);

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

function readSource(url) {
  return readFileSync(url, "utf8");
}

function readNestedValue(object, key) {
  return key.split(".").reduce((current, segment) => current?.[segment], object);
}

test("discover localization source keeps collection copy out of query definitions", async () => {
  const { DISCOVER_COLLECTIONS } = await import("../../discover/collections.ts");

  assert.deepEqual(
    DISCOVER_COLLECTIONS.map((collection) => ({
      id: collection.id,
      titleKey: collection.titleKey,
      descriptionKey: collection.descriptionKey,
    })),
    [
      {
        id: "hidden-gems",
        titleKey: "discover.collections.hiddenGems.title",
        descriptionKey: "discover.collections.hiddenGems.description",
      },
      {
        id: "quick-watch",
        titleKey: "discover.collections.quickWatch.title",
        descriptionKey: "discover.collections.quickWatch.description",
      },
      {
        id: "90s-essentials",
        titleKey: "discover.collections.ninetiesEssentials.title",
        descriptionKey: "discover.collections.ninetiesEssentials.description",
      },
      {
        id: "modern-classics",
        titleKey: "discover.collections.modernClassics.title",
        descriptionKey: "discover.collections.modernClassics.description",
      },
      {
        id: "critically-acclaimed",
        titleKey: "discover.collections.criticallyAcclaimed.title",
        descriptionKey: "discover.collections.criticallyAcclaimed.description",
      },
      {
        id: "something-weird",
        titleKey: "discover.collections.somethingWeird.title",
        descriptionKey: "discover.collections.somethingWeird.description",
      },
      {
        id: "new-this-month",
        titleKey: "discover.collections.newThisMonth.title",
        descriptionKey: "discover.collections.newThisMonth.description",
      },
    ],
  );

  assert.doesNotMatch(readSource(discoverCollectionsUrl), /defaultTitle|defaultDescription/);
});

test("discover localization defaults stay inline so the extractor can see them", () => {
  const extracted = extractKinoTranslations(readSource(discoverLocalizationUrl)).keys;
  const extractedDefaults = Object.fromEntries(
    extracted.map(({ keyName, defaultValue }) => [keyName, defaultValue]),
  );

  assert.deepEqual(extractedDefaults, {
    "discover.forYou": "For You",
    "discover.exploreCollections": "Explore collections",
    "discover.collections.hiddenGems.title": "Hidden Gems",
    "discover.collections.hiddenGems.description":
      "Highly rated titles you may have missed",
    "discover.collections.quickWatch.title": "Quick Watch",
    "discover.collections.quickWatch.description":
      "Great movies under 100 minutes",
    "discover.collections.ninetiesEssentials.title": "90s Essentials",
    "discover.collections.ninetiesEssentials.description":
      "Essential titles from the 1990s",
    "discover.collections.modernClassics.title": "Modern Classics",
    "discover.collections.modernClassics.description":
      "Beloved titles from 2000 to 2019",
    "discover.collections.criticallyAcclaimed.title": "Critically Acclaimed",
    "discover.collections.criticallyAcclaimed.description":
      "Widely praised titles with a lasting reputation",
    "discover.collections.somethingWeird.title": "Something Weird",
    "discover.collections.somethingWeird.description":
      "Unusual, underseen titles worth discovering",
    "discover.collections.newThisMonth.title": "New This Month",
    "discover.collections.newThisMonth.description":
      "Recent releases from your region",
    "discover.collections.active.label": "Collection",
    "discover.collections.open": "Open collection",
    "discover.collections.explore.description":
      "Editorial picks for nights when you want a strong starting point.",
    "discover.personalized.becauseYouLiked": "Because you liked {{title}}",
    "discover.personalized.moreFromDirectors": "More from {{name}}",
    "discover.personalized.exploreMoreGenre": "Explore more {{genre}}",
    "discover.personalized.popularAmongFollowing":
      "Popular among people you follow",
    "discover.collections.clear": "Clear collection",
  });
});

test("generated English discover catalog includes the expected collection and personalization copy", () => {
  const english = readJson(englishUrl);

  const expectedDefaults = {
    "discover.forYou": "For You",
    "discover.exploreCollections": "Explore collections",
    "discover.collections.hiddenGems.title": "Hidden Gems",
    "discover.collections.hiddenGems.description":
      "Highly rated titles you may have missed",
    "discover.collections.quickWatch.title": "Quick Watch",
    "discover.collections.quickWatch.description":
      "Great movies under 100 minutes",
    "discover.collections.ninetiesEssentials.title": "90s Essentials",
    "discover.collections.ninetiesEssentials.description":
      "Essential titles from the 1990s",
    "discover.collections.modernClassics.title": "Modern Classics",
    "discover.collections.modernClassics.description":
      "Beloved titles from 2000 to 2019",
    "discover.collections.criticallyAcclaimed.title": "Critically Acclaimed",
    "discover.collections.criticallyAcclaimed.description":
      "Widely praised titles with a lasting reputation",
    "discover.collections.somethingWeird.title": "Something Weird",
    "discover.collections.somethingWeird.description":
      "Unusual, underseen titles worth discovering",
    "discover.collections.newThisMonth.title": "New This Month",
    "discover.collections.newThisMonth.description":
      "Recent releases from your region",
    "discover.collections.active.label": "Collection",
    "discover.collections.open": "Open collection",
    "discover.collections.explore.description":
      "Editorial picks for nights when you want a strong starting point.",
    "discover.personalized.becauseYouLiked": "Because you liked {{title}}",
    "discover.personalized.moreFromDirectors": "More from {{name}}",
    "discover.personalized.exploreMoreGenre": "Explore more {{genre}}",
    "discover.personalized.popularAmongFollowing":
      "Popular among people you follow",
    "discover.collections.clear": "Clear collection",
  };

  for (const [key, value] of Object.entries(expectedDefaults)) {
    assert.equal(readNestedValue(english, key), value, `Expected ${key} to equal ${value}`);
  }
});
