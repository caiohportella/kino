import { getTMDbImageUrl } from "@kino/core";
import { Vibrant } from "node-vibrant/node";
import { cache } from "react";

export type ImagePalette = {
  colors: string[];
};

export const getImagePalette = cache(
  async (posterPath: string | null): Promise<ImagePalette | null> => {
    if (!posterPath) return null;
    const imageUrl = getTMDbImageUrl(posterPath, "w500");
    if (!imageUrl) return null;
    try {
      const palette = await Vibrant.from(imageUrl).getPalette();
      const swatches = [
        palette.Vibrant,
        palette.LightVibrant,
        palette.DarkVibrant,
        palette.Muted,
        palette.LightMuted,
        palette.DarkMuted,
      ].filter((s): s is Exclude<typeof s, null> => s !== null);

      // Sort by population (pixel coverage) so the color that dominates the
      // poster wins, rather than the most saturated one. A small orange
      // accent can out-saturate a large muted-blue background otherwise.
      const byPopulation = [...swatches].sort(
        (a, b) => b.population - a.population,
      );

      return {
        colors: [...new Set(byPopulation.map((s) => s.hex))],
      };
    } catch {
      return null;
    }
  },
);
