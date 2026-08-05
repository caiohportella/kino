import type { CarouselTitle, TMDbTitle } from "@kino/core";
import { getImagePalette } from "./image-palette";

function colorDistance(a: string, b: string) {
  const rgb = (hex: string) => ({
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  });

  const c1 = rgb(a);
  const c2 = rgb(b);

  return Math.sqrt(
    (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2,
  );
}

export async function enrichTitlesWithPalette(
  titles: TMDbTitle[],
): Promise<CarouselTitle[]> {
  const result: CarouselTitle[] = [];

  let previousColor: string | null = null;

  for (const title of titles) {
    const palette = await getImagePalette(title.poster_path);

    const colors = palette?.colors ?? [];

    const color =
      colors.find(
        (candidate) =>
          previousColor === null ||
          colorDistance(candidate, previousColor) > 80,
      ) ??
      colors.at(0) ??
      "#ffffff";

    previousColor = color;

    result.push({
      ...title,
      paletteColor: color,
    });
  }

  return result;
}
