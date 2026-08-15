import type {
  MediaType,
  SearchEntity,
  SearchEntityV2,
  SearchMediaType,
  SearchProviderResult,
  TMDbTitle,
} from '@kino/core'

import type { RedisSearchClientConfig } from './client.ts'
import {
  type RedisIndexerConfig,
  resolveRedisClient,
  toArray,
  writeJsonDocuments,
} from './indexer-utils.ts'
import { TITLE_KEY_PREFIX } from './indexes.ts'
import {
  normalizeTitleDocument,
  type TitleDocumentInput,
  type TitleSearchDocument,
  titleDocumentFromTmdb,
} from './title-document.ts'

export interface TitleIndexer {
  upsert(input: TitleDocumentInput | readonly TitleDocumentInput[]): Promise<void>
  upsertDocument(document: TitleSearchDocument | readonly TitleSearchDocument[]): Promise<void>
  deleteTitle(mediaType: MediaType | SearchMediaType, tmdbId: number): Promise<void>
}

export function createTitleIndexer(config: RedisIndexerConfig): TitleIndexer {
  const { client, batchSize } = resolveRedisClient(config)
  return {
    async upsert(input) {
      const documents = toArray(input)
        .map(normalizeTitleDocument)
        .filter((item): item is TitleSearchDocument => item !== null)
      await this.upsertDocument(documents)
    },

    async upsertDocument(document) {
      const documents = toArray(document)
      if (documents.length === 0) return
      await writeJsonDocuments(
        client,
        documents.map((value) => ({
          key: `${TITLE_KEY_PREFIX}${value.id.slice('title:'.length)}`,
          value,
        })),
        batchSize
      )
    },

    async deleteTitle(mediaType, tmdbId) {
      const type = mediaType === 'tv' || mediaType === 'series' ? 'series' : 'movie'
      await client.del(`${TITLE_KEY_PREFIX}${type}:${tmdbId}`)
    },
  }
}

export function titleDocumentFromSearchEntity(
  entity: SearchEntity &
    Partial<SearchEntityV2> & {
      readonly entityType: SearchMediaType
      readonly voteAverage?: number | null
    }
): TitleSearchDocument | null {
  const tmdbId = entity.tmdbId ?? Number(entity.id.replace(/\D+/gu, ''))
  return normalizeTitleDocument({
    tmdbId,
    type: entity.entityType,
    title: entity.title,
    overview: entity.summary,
    year: entity.year,
    popularity: entity.popularity,
    voteAverage: entity.tmdbVoteAverage ?? entity.kinoAverageRating ?? entity.voteAverage,
    voteCount: entity.voteCount,
  })
}

export function titleDocumentFromTmdbTitle(input: {
  readonly mediaType: MediaType | SearchMediaType
  readonly title: TMDbTitle
  readonly originalTitle?: string | null
  readonly originalName?: string | null
  readonly aliases?: readonly string[]
  readonly genreNames?: readonly unknown[]
  readonly cast?: readonly unknown[]
  readonly creators?: readonly unknown[]
  readonly directors?: readonly unknown[]
  readonly keywords?: readonly string[]
  readonly locale?: string | null
}): TitleSearchDocument | null {
  return titleDocumentFromTmdb({
    type: input.mediaType,
    title: input.title,
    originalTitle: input.originalTitle,
    originalName: input.originalName,
    aliases: input.aliases,
    genreNames: input.genreNames,
    cast: input.cast,
    creators: input.creators,
    directors: input.directors,
    keywords: input.keywords,
  })
}

export function titleDocumentsFromSearchResponse(
  result: SearchProviderResult
): readonly TitleSearchDocument[] {
  return result.candidates.flatMap((candidate) => {
    if (candidate.entity.entityType !== 'movie' && candidate.entity.entityType !== 'series')
      return []
    const document = titleDocumentFromSearchEntity(
      candidate.entity as SearchEntity &
        Partial<SearchEntityV2> & { readonly entityType: SearchMediaType }
    )
    return document ? [document] : []
  })
}

export type { RedisSearchClientConfig }
