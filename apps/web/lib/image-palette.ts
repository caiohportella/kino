import { Vibrant } from "node-vibrant/node";
import { cache } from "react";
import { getTMDbImageUrl } from "@kino/core";

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

      return {
        colors: [...new Set(swatches.map((s) => s.hex))],
      };
    } catch {
      return null;
    }
  },
);
