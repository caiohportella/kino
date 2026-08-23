import { getTMDbImageUrl } from '@kino/core'
import { unstable_cache } from 'next/cache'
import { Vibrant } from 'node-vibrant/node'

export type ImagePalette = {
  colors: string[]
}

async function computeImagePalette(posterPath: string): Promise<ImagePalette | null> {
  const imageUrl = getTMDbImageUrl(posterPath, 'w300')

  if (!imageUrl) {
    return null
  }

  try {
    const palette = await Vibrant.from(imageUrl).getPalette()

    const swatches = [
      palette.Vibrant,
      palette.LightVibrant,
      palette.DarkVibrant,
      palette.Muted,
      palette.LightMuted,
      palette.DarkMuted,
    ].filter((s): s is Exclude<typeof s, null> => s !== null)

    const byPopulation = [...swatches].sort((a, b) => b.population - a.population)

    return {
      colors: [...new Set(byPopulation.map((s) => s.hex))],
    }
  } catch {
    return null
  }
}

const getCachedImagePalette = unstable_cache(computeImagePalette, ['tmdb-image-palette-v1'], {
  revalidate: 60 * 60 * 24 * 30,
})

export async function getImagePalette(posterPath: string | null): Promise<ImagePalette | null> {
  if (!posterPath) {
    return null
  }

  return getCachedImagePalette(posterPath)
}
