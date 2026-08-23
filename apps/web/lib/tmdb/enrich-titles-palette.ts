import type { CarouselTitle, TMDbTitle } from '@kino/core'
import { getImagePalette } from './image-palette'

const PALETTE_CONCURRENCY = 6

function colorDistance(a: string, b: string) {
  const rgb = (hex: string) => ({
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  })

  const c1 = rgb(a)
  const c2 = rgb(b)

  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2)
}

async function extractPalettes(titles: TMDbTitle[]) {
  const palettes: Awaited<ReturnType<typeof getImagePalette>>[] = []

  for (let index = 0; index < titles.length; index += PALETTE_CONCURRENCY) {
    const batch = titles.slice(index, index + PALETTE_CONCURRENCY)

    const batchPalettes = await Promise.all(
      batch.map((title) => getImagePalette(title.poster_path))
    )

    palettes.push(...batchPalettes)
  }

  return palettes
}

export async function enrichTitlesWithPalette(titles: TMDbTitle[]): Promise<CarouselTitle[]> {
  const palettes = await extractPalettes(titles)

  let previousColor: string | null = null

  return titles.map((title, index) => {
    const colors = palettes[index]?.colors ?? []

    const color =
      colors.find(
        (candidate) => previousColor === null || colorDistance(candidate, previousColor) > 80
      ) ??
      colors.at(0) ??
      '#ffffff'

    previousColor = color

    return {
      ...title,
      paletteColor: color,
    }
  })
}
