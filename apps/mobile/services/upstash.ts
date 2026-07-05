import { Index } from '@upstash/vector'
import { TMDbTitle } from '~/types'

const UPSTASH_VECTOR_REST_URL = process.env.EXPO_PUBLIC_UPSTASH_VECTOR_REST_URL
const UPSTASH_VECTOR_REST_TOKEN = process.env.EXPO_PUBLIC_UPSTASH_VECTOR_REST_TOKEN

if (!UPSTASH_VECTOR_REST_URL || !UPSTASH_VECTOR_REST_TOKEN) {
  console.warn('Upstash Vector credentials are missing. Semantic search will not work.')
}

const index = new Index({
  url: UPSTASH_VECTOR_REST_URL!,
  token: UPSTASH_VECTOR_REST_TOKEN!,
})

export interface SemanticSearchResult extends TMDbTitle {
  score: number
}

interface UpstashMetadata {
  id: string | number
  title?: string
  name?: string
  poster_path?: string
  backdrop_path?: string
  overview?: string
  release_date?: string
  first_air_date?: string
  vote_average?: number
  genre_ids?: number[]
  media_type?: 'movie' | 'tv'
}

export const semanticSearch = async (
  query: string,
  topK: number = 20
): Promise<SemanticSearchResult[]> => {
  if (!query.trim()) return []

  try {
    // We assume the index has an embedding model configured, allowing us to pass raw text 'data'.
    const results = await index.query({
      data: query,
      topK,
      includeMetadata: true,
    })

    // Map Upstash results to our TMDbTitle format
    // Expecting metadata to contain the movie/show details compatible with TMDbTitle
    return results.map((result) => {
      const metadata = result.metadata as unknown as UpstashMetadata
      return {
        id: typeof metadata.id === 'string' ? parseInt(metadata.id) : metadata.id,
        title: metadata.title || metadata.name || 'Unknown Title',
        poster_path: metadata.poster_path,
        backdrop_path: metadata.backdrop_path,
        overview: metadata.overview,
        release_date: metadata.release_date || metadata.first_air_date,
        vote_average: metadata.vote_average,
        genre_ids: metadata.genre_ids || [],
        media_type: metadata.media_type || 'movie',
        score: result.score,
      } as SemanticSearchResult
    })
  } catch (error) {
    console.error('Semantic search error:', error)
    throw error
  }
}
